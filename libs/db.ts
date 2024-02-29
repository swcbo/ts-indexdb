import type {
	ConditionMap,
	DBRequestEventTarget,
	DBTable,
	DbOperator,
	Options,
} from './types';
import { isSameOptions } from './utils';

export class IndexDB {
	/**
	 * Static instance variable to hold the singleton instance
	 */
	private static instance: IndexDB | undefined;
	/**
	 * database name(数据库名称)
	 */
	private name: string = '';
	/**
	 * database version(数据库版本)
	 */
	private version: number = 1;
	/**
	 * List of database tables(数据表列表)
	 */
	private tableList: DBTable[] = [];
	/**
	 * db instance
	 */
	private db: IDBDatabase | undefined = void 0;
	/**
	 * transaction queue(事务队列)
	 *
	 * 实例化一次以后下次打开页面时数据库自启动
	 */
	private queue: (() => void)[] = [];
	/**
	 * db connect status(数据库连接状态)
	 */
	connectStatus: boolean = false;
	/**
	 * Private constructor to prevent instantiation from outside the class.
	 *
	 * This ensures that the class can only be instantiated from within the getInstance method,
	 *
	 * enforcing the singleton pattern.
	 *
	 * 将构造函数设置为私有，防止外部直接创建类的实例
	 *
	 * @param {Options} options - The configuration options for the database, including name, version, and tables.
	 */
	private constructor({ name, version, tables }: Options) {
		this.name = name;
		this.version = version;
		this.tableList = tables;
		// Singleton
		IndexDB.instance = this;
	}
	/**
	 * 打开或创建并打开数据库。
	 *
	 * Opens or creates and then opens a database.
	 *
	 * @returns {Promise<IndexDB>} 返回一个Promise，该Promise在数据库成功打开后解析为当前IndexDB实例。
	 *
	 * Returns a promise that resolves to the current IndexDB instance once the database is successfully opened.
	 *
	 * 如果在打开数据库过程中遇到错误，Promise将被拒绝，并返回错误信息。
	 *
	 * If an error is encountered during the database opening process, the promise is rejected and returns an error message.
	 *
	 * @example
	 * const db = new IndexDB({ name: 'myDatabase', version: 1 });
	 * db.open().then(() => {
	 *     console.log('Database opened successfully');
	 * }).catch((error) => {
	 *     console.error('Failed to open database', error);
	 * });
	 */
	open() {
		// 尝试根据指定的名称和版本号打开一个IndexedDB数据库。
		// 如果成功连接，它将处理事务队列，然后返回当前数据库连接实例。
		// 如果连接过程中遇到错误，则通过回调返回错误信息。
		// 如果指定版本的数据库不存在，浏览器将尝试创建它，并可能自动触发数据库结构的更新。
		// Attempts to open an IndexedDB database with the specified name and version.
		// Upon successful connection, it processes the transaction queue, then returns the current database connection instance.
		// If an error is encountered during the connection process, it returns the error information via callback.
		// If the specified version of the database does not exist, the browser will attempt to create it, potentially triggering automatic updates to the database structure.

		return new Promise<IndexDB>((resolve, reject) => {
			if (window.indexedDB) {
				const request = window.indexedDB.open(this.name, this.version);

				request.onerror = (e) => {
					// 处理数据库打开过程中遇到的错误。
					// Handles errors encountered during the database opening process.
					reject(e);
				};

				request.onsuccess = (event) => {
					// 数据库成功打开后的处理逻辑。
					// Processes after the database has successfully opened.
					if (event.target) {
						this.db = (event.target as DBRequestEventTarget).result;
						// 依次处理事务队列中的任务。
						// Processes tasks in the transaction queue.
						let task: undefined | (() => void) = void 0;
						while ((task = this.queue.shift())) {
							task?.();
						}
						this.connectStatus = true; // 标记为已连接状态。
						resolve(this); // 解析Promise为当前实例。
					}
				};
				// 当数据库版本不存在或需要升级时触发，自动创建或更新表结构。
				// This triggers the `onupgradeneeded` event for creating or updating table structures automatically.
				request.onupgradeneeded = (e) => {
					this.tableList.forEach((table: DBTable) => {
						if (e.target) {
							this.create_table((e.target as any).result, table);
						}
					});
				};
			} else {
				// 若当前环境不支持IndexedDB。
				// If IndexedDB is not supported in the current environment.
				reject('IndexedDB is not supported in this environment.');
			}
		});
	}
	/**
	 * 关闭数据库连接
	 *
	 * Closes the database connection
	 *
	 * 此方法用于关闭当前打开的数据库连接
	 *
	 * This method is used to close the currently open database connection.
	 *
	 * @returns {Promise<boolean>} 返回一个承诺，该承诺在数据库成功关闭时解析为true，如果关闭过程中出现错误，则拒绝。
	 *
	 * Returns a promise that resolves to true when the database is successfully closed, or rejects if there is an error during the closure process.
	 */
	close() {
		return new Promise<boolean>((resolve, reject) => {
			try {
				// 如果数据库已经打开，它会关闭数据库，重置实例属性，并将单例实例设置为undefined，表示没有活动的数据库连接
				// If the database is open, it closes the database, resets the instance properties,
				// and sets the singleton instance to undefined
				if (this.db) {
					this.db.close();
					this.db = void 0;
					IndexDB.instance = void 0;
					this.name = '';
					this.version = 1;
					this.tableList = [];
					this.connectStatus = false;
				} else {
					// 如果在没有打开数据库的情况下调用此方法，它将输出一条提示信息，告知用户首先需要连接到数据库。
					// If this method is called without an open database, it logs a message prompting the user to connect to a database first.
					console.log('Please connect to a database before calling close.');
				}
				resolve(true); // 成功关闭数据库，解析承诺为true
			} catch (error) {
				reject(error); // 如果关闭数据库过程中发生错误，拒绝承诺
			}
		});
	}
	/**
	 * 初始化数据库实例
	 *
	 * Initializes the database instance.
	 *
	 * 此方法检查是否已经存在一个IndexDB实例。
	 *
	 * @param {Options} options - 包含数据库名称、版本和表结构的配置选项
	 *
	 * Configuration options containing the database name, version, and table structures.)
	 *
	 * @returns {Promise<IndexDB>} 返回一个承诺，该承诺在数据库成功初始化后解析为IndexDB实例
	 *
	 * Returns a promise that resolves to the IndexDB instance once the database has been successfully initialized.
	 */
	public static init(options: Options): Promise<IndexDB> {
		// 如果实例已存在，它将比较当前实例的配置与新提供的配置。
		// This method checks if an IndexDB instance already exists.
		if (this.instance) {
			const old = {
				name: this.instance.name,
				version: this.instance.version,
				tables: this.instance.tableList,
			};
			if (isSameOptions(old, options)) {
				// 配置相同，将发出警告提示不应重复初始化
				// If the configuration is the same,
				// a warning is issued that the instance should not be initialized repeatedly				console.warn('The instance should not be initialized repeatedly');
			} else {
				// 配置不同，发出警告说明无法用新配置重置当前实例
				// If the configurations differ, a warning is issued that the current instance cannot be reset with new configurations.
				console.warn('Unable to reset the current instance with the new configuration');
			}
			// 返回现有实例的承诺
			return Promise.resolve(this.instance);
		}
		// 如果不存在，它将创建一个新的实例，并打开数据库
		// If not, it creates a new instance and opens the database.
		this.instance = new IndexDB(options);
		return this.instance.open();
	}
	/**
	 * 获取IndexDB类的单例实例
	 * Retrieves the singleton instance of the IndexDB class
	 *
	 * 此方法用于获取已经初始化的IndexDB实例,如果实例尚未通过init方法初始化，则抛出错误。
	 *
	 *
	 * This method is used to obtain the already initialized IndexDB instance.
	 * If the instance has not been initialized through the init method, it throws an error.
	 *
	 * @returns {IndexDB} 返回IndexDB的单例实例
	 *
	 * Returns the singleton instance of the IndexDB.
	 */
	public static getInstance(): IndexDB {
		// 注意：在调用此方法之前，必须先调用init方法进行初始化。
		// Note: The init method must be called to initialize before calling this method.
		if (this.instance) {
			return this.instance;
		}
		// 如果在未初始化的情况下调用getInstance，将抛出错误提示先调用init
		// If getInstance is called without initialization, an error is thrown advising to call init first
		throw Error('IndexDB instance not initialized. Call init() first.');
	}
	/**
	 * 提交Db请求
	 * @param name  表名
	 * @param commit 提交具体函数
	 * @param mode 事物方式
	 * @param backF 游标方法
	 */
	private commit<T>(
		name: string,
		commitFn?: (transaction: IDBObjectStore) => IDBRequest,
		mode: IDBTransactionMode = 'readwrite',
		callback?: (request: any, resolve: any, store: IDBObjectStore) => void,
	) {
		return new Promise<T>((resolve, reject) => {
			const task = () => {
				try {
					if (this.db) {
						const store = this.db.transaction(name, mode).objectStore(name);
						if (!commitFn) {
							callback!(null, resolve, store);
							return;
						}
						const res = commitFn(store);
						// todo
						res.onsuccess = (e: any) => {
							if (typeof callback === 'function') {
								callback(e, resolve, store);
							} else {
								resolve(e);
							}
						};
						res.onerror = (event) => {
							reject(event);
						};
					} else {
						reject(new Error('请开启数据库'));
					}
				} catch (error) {
					reject(error);
				}
			};

			if (!this.db) {
				this.queue.push(task);
			} else {
				task();
			}
		});
	}

	//=================relate select================================
	/**
	 * @method 查询某张表的所有数据(返回具体数组)
	 * @param {Object}
	 *   @property {String} tableName 表名
	 */
	queryAll<T>({ tableName }: Pick<DbOperator<T>, 'tableName'>) {
		const res: T[] = [];
		return this.commit<T[]>(
			tableName,
			(transaction: IDBObjectStore) => transaction.openCursor(),
			'readonly',
			(e: any, resolve: (data: T[]) => void) => {
				this.cursor_success(e, {
					condition: () => true,
					handler: ({ currentValue }: any) => res.push(currentValue),
					success: () => resolve(res),
				});
			},
		);
	}

	/**
	 * @method 查询(返回具体数组)
	 * @param {Object}
	 *   @property {String} tableName 表名
	 *   @property {Function} condition 查询的条件
	 * */
	query<T>({ tableName, condition }: Pick<DbOperator<T>, 'condition' | 'tableName'>) {
		const res: T[] = [];
		return this.commit<T[]>(
			tableName,
			(transaction: IDBObjectStore) => transaction.openCursor(),
			'readonly',
			(e: any, resolve: (data: T[]) => void) => {
				this.cursor_success(e, {
					condition,
					handler: ({ currentValue }: any) => res.push(currentValue),
					success: () => resolve(res),
				});
			},
		);
	}

	/**
	 * @method 查询满足key条件的个数(返回满足条件的数字个数)
	 * @param {Object}
	 *   @property {String} tableName 表名
	 *   @property {Number|String} key 查询的key
	 *   @property {Object} countCondition 查询条件
	 * */
	/** countCondition传入方式 key 必须为已经简历索引的字段
     *  key ≥ x	            {key: 'gt' rangeValue: [x]}
        key > x	            {key: 'gt' rangeValue: [x, true]}
        key ≤ y	            {key: 'lt' rangeValue: [y]}
        key < y	            {key: 'lt' rangeValue: [y, true]}
        key ≥ x && ≤ y	    {key: 'between' rangeValue: [x, y]}
        key > x &&< y	    {key: 'between' rangeValue: [x, y, true, true]}
        key > x && ≤ y	    {key: 'between' rangeValue: [x, y, true, false]}
        key ≥ x &&< y	    {key: 'between' rangeValue: [x, y, false, true]}
        key = z	            {key: 'equal' rangeValue: [z]}
     */
	count<T>({
		name,
		tableName,
		key,
		countCondition,
	}: Pick<DbOperator<T>, 'key' | 'tableName' | 'countCondition' | 'name'>) {
		const mapCondition: ConditionMap = {
			equal: IDBKeyRange.only,
			gt: IDBKeyRange.lowerBound,
			lt: IDBKeyRange.upperBound,
			between: IDBKeyRange.bound,
		};
		return this.commit<T>(
			name || tableName,
			(transaction: IDBObjectStore) => {
				const count = transaction.index(key).count;
				if (countCondition.type === 'equal') {
					return count(mapCondition.equal(...countCondition.rangeValue));
				} else if (countCondition.type === 'gt') {
					return count(mapCondition.gt(...countCondition.rangeValue));
				} else if (countCondition.type === 'lt') {
					return count(mapCondition.lt(...countCondition.rangeValue));
				} else {
					return count(mapCondition.between(...countCondition.rangeValue));
				}
			},
			'readonly',
			(e: any, resolve: (data: T) => void) => {
				resolve(e.target.result || null);
			},
		);
	}

	/**
	 * @method 查询数据(更具表具体属性)返回具体某一个
	 * @param {Object}
	 *   @property {String} tableName 表名
	 *   @property {Number|String} key 名
	 *   @property {Number|String} value 值
	 *
	 * */
	query_by_keyValue<T>({
		name,
		tableName,
		key,
		value,
	}: Pick<DbOperator<T>, 'name' | 'tableName' | 'key' | 'value'>) {
		return this.commit<T>(
			name || tableName,
			(transaction: IDBObjectStore) => transaction.index(key).get(value),
			'readonly',
			(e: any, resolve: (data: T) => void) => {
				resolve(e.target.result || null);
			},
		);
	}

	/**
	 * @method 查询数据（主键值）
	 * @param {Object}
	 *   @property {String} tableName 表名
	 *   @property {Number|String} value 主键值
	 *
	 * */
	query_by_primaryKey<T>({
		name,
		tableName,
		value,
	}: Pick<DbOperator<T>, 'name' | 'tableName' | 'value'>) {
		return this.commit<T>(
			name || tableName,
			(transaction: IDBObjectStore) => transaction.get(value),
			'readonly',
			(e: any, resolve: (data: T) => void) => {
				resolve(e.target.result || null);
			},
		);
	}

	//=================relate update================================
	/**
	 * @method 修改数据(返回修改的数组)
	 * @param {Object}
	 *   @property {String} tableName 表名
	 *   @property {Function} condition 查询的条件，遍历，与filter类似
	 *      @arg {Object} 每个元素
	 *      @return 条件
	 *   @property {Function} handle 处理函数，接收本条数据的引用，对其修改
	 * */
	update<T>({
		name,
		tableName,
		condition,
		handle,
	}: Pick<DbOperator<T>, 'name' | 'tableName' | 'condition' | 'handle'>) {
		const res: T[] = [];
		return this.commit<T>(
			name || tableName,
			(transaction: IDBObjectStore) => transaction.openCursor(),
			'readwrite',
			(e: any, resolve: (data: T[]) => void) => {
				this.cursor_success(e, {
					condition,
					handler: ({ currentValue, cursor }: any) => {
						const value = handle(currentValue);
						res.push(value as any);
						cursor.update(value);
					},
					success: () => {
						resolve(res);
					},
				});
			},
		);
	}

	/**
	 * @method 修改某条数据(主键)返回修改的对象
	 * @param {Object}
	 *   @property {String} tableName 表名
	 *   @property {String\|Number} value 目标主键值
	 *   @property {Function} handle 处理函数，接收本条数据的引用，对其修改
	 * */
	update_by_primaryKey<T>({
		name,
		tableName,
		value,
		handle,
	}: Pick<DbOperator<T>, 'name' | 'tableName' | 'value' | 'handle'>) {
		return this.commit<T>(
			name || tableName,
			(transaction: IDBObjectStore) => transaction.get(value),
			'readwrite',
			(e: any, resolve: (data: T | null) => void, store: IDBObjectStore) => {
				const currentValue = e.target.result;
				if (!currentValue) {
					resolve(null);
					return;
				}
				const value = handle(currentValue);
				store.put(value);
				resolve(value as any);
			},
		);
	}

	//=================relate insert================================
	/**
	 * @method 增加数据
	 * @param {Object}
	 *   @property {String} tableName 表名
	 *   @property {Object} data 插入的数据
	 * */
	insert<T>({
		name,
		tableName,
		data,
	}: Pick<DbOperator<T>, 'name' | 'tableName' | 'data'>) {
		return this.commit<T>(
			name || tableName,
			void 0,
			'readwrite',
			(_: any, resolve: () => void, store: IDBObjectStore) => {
				data instanceof Array ? data.forEach((v) => store.put(v)) : store.put(data);
				resolve();
			},
		);
	}
	//=================relate delete================================
	/**
	 * @method 删除数据(返回删除数组)
	 * @param {Object}
	 *   @property {String} tableName 表名
	 *   @property {Function} condition 查询的条件，遍历，与filter类似
	 *      @arg {Object} 每个元素
	 *      @return 条件
	 * */
	delete<T>({
		name,
		tableName,
		condition,
	}: Pick<DbOperator<T>, 'name' | 'tableName' | 'condition'>) {
		const res: T[] = [];
		return this.commit<T>(
			name || tableName,
			(transaction: IDBObjectStore) => transaction.openCursor(),
			'readwrite',
			(e: any, resolve: (data: T[]) => void) => {
				this.cursor_success(e, {
					condition,
					handler: ({ currentValue, cursor }: any) => {
						res.push(currentValue);
						cursor.delete();
					},
					success: () => {
						resolve(res);
					},
				});
			},
		);
	}

	/**
	 * @method 删除数据(主键)
	 * @param {Object}
	 *   @property {String} tableName 表名
	 *   @property {String\|Number} value 目标主键值
	 * */
	delete_by_primaryKey<T>({
		name,
		tableName,
		value,
	}: Pick<DbOperator<T>, 'name' | 'tableName' | 'value'>) {
		return this.commit<T>(
			name || tableName,
			(transaction: IDBObjectStore) => transaction.delete(value),
			'readwrite',
			(e: any, resolve: () => void) => {
				resolve();
			},
		);
	}

	//=================relate db================================

	/**
	 * @method 删除数据库
	 * @param {String}name 数据库名称
	 */
	delete_db(name: string) {
		return new Promise((resolve, reject) => {
			const request = indexedDB.deleteDatabase(name);
			request.onerror = (e) => {
				reject(e);
			};
			request.onsuccess = (e) => {
				resolve(e);
			};
		});
	}
	/**
	 * @method 删除表数据
	 * @param {String}name 数据库名称
	 */
	delete_table(name: string) {
		return this.commit(
			name,
			(transaction: IDBObjectStore) => transaction.clear(),
			'readwrite',
			(_: any, resolve: () => void) => {
				resolve();
			},
		);
	}
	/**
	 * 创建table
	 * @option<Object>  keyPath指定主键 autoIncrement是否自增
	 * @index 索引配置
	 * */
	private create_table(
		idb: IDBDatabase,
		{ name, tableName, option, indexs, indexes }: DBTable,
	) {
		const target = name || tableName;
		if (!idb.objectStoreNames.contains(target)) {
			const store = idb.createObjectStore(target, option);
			const entries = indexes || indexs || [];
			for (const { key, option } of entries) {
				store.createIndex(key, key, option);
			}
		}
	}
	/**
	 * @method 游标开启成功,遍历游标
	 * @param {Function} 条件
	 * @param {Function} 满足条件的处理方式 @arg {Object} @property cursor游标 @property currentValue当前值
	 * @param {Function} 游标遍历完执行的方法
	 * @return {Null}
	 * */
	cursor_success(e: any, { condition, handler, success }: any): void {
		const cursor: IDBCursorWithValue = e.target.result;
		if (cursor) {
			const currentValue = cursor.value;
			if (condition(currentValue)) handler({ cursor, currentValue });
			cursor.continue();
		} else {
			success();
		}
	}

	getConnectStatus() {
		return this.connectStatus;
	}
}
