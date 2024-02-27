import type {
	ConditionMap,
	DBRequestEventTarget,
	DBTable,
	DbOperator,
	Options,
} from './types';

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

	public static init(options: Options): Promise<IndexDB> {
		if (!this.instance) {
			this.instance = new IndexDB(options);
			return this.instance.open_db();
		}
		return Promise.resolve(this.instance);
	}
	/**
	 * Public static method to get the singleton instance of the IndexDB class.
	 * If an instance does not already exist, it creates one with the provided options.
	 * If an instance already exists, it returns that instance, ignoring any passed options.
	 *
	 * This method ensures that there is only ever one instance of the IndexDB class.
	 *
	 * @param {Options} options - The configuration options for the database, necessary only when creating the instance for the first time.
	 * @returns {IndexDB} The singleton instance of the IndexDB class.
	 */
	public static getInstance(): IndexDB {
		if (!this.instance) {
			throw Error('IndexDB instance not initialized. Call init() first.');
		}
		return this.instance;
	}

	/**
	 * 提交Db请求
	 * @param name  表名
	 * @param commit 提交具体函数
	 * @param mode 事物方式
	 * @param backF 游标方法
	 */
	private commitDb<T>(
		name: string,
		commit?: (transaction: IDBObjectStore) => IDBRequest,
		mode: IDBTransactionMode = 'readwrite',
		callback?: (request: any, resolve: any, store: IDBObjectStore) => void,
	) {
		return new Promise<T>((resolve, reject) => {
			const task = () => {
				try {
					if (this.db) {
						const store = this.db.transaction(name, mode).objectStore(name);
						if (!commit) {
							callback!(null, resolve, store);
							return;
						}
						const res = commit(store);
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
		return this.commitDb<T[]>(
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
		return this.commitDb<T[]>(
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
		return this.commitDb<T>(
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
		return this.commitDb<T>(
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
		return this.commitDb<T>(
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
		return this.commitDb<T>(
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
		return this.commitDb<T>(
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
		return this.commitDb<T>(
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
		return this.commitDb<T>(
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
		return this.commitDb<T>(
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
	 * @method 打开数据库
	 */
	open_db() {
		return new Promise<IndexDB>((resolve, reject) => {
			const request = window.indexedDB.open(this.name, this.version);
			request.onerror = (e) => {
				reject(e);
			};
			request.onsuccess = (event) => {
				if (event.target) {
					this.db = (event.target as DBRequestEventTarget).result;
					let task: undefined | (() => void) = void 0;

					while (task) {
						task = this.queue.shift();
						if (task) {
							task();
						}
					}
					this.connectStatus = true;
					resolve(this);
				}
			};
			//数据库升级
			request.onupgradeneeded = (e) => {
				this.tableList.forEach((element: DBTable) => {
					if (e.target) {
						this.create_table((e.target as any).result, element);
					}
				});
			};
		});
	}

	/**
	 *@method 关闭数据库
	 * @param  {[type]} db [数据库名称]
	 */
	close_db() {
		return new Promise((resolve, reject) => {
			try {
				if (!this.db) {
					resolve('请开启数据库');
					return;
				}
				if (typeof this.db.close === 'function') {
					this.db.close();
				}
				this.db = void 0;
				IndexDB.instance = void 0;
				this.connectStatus = false;
				resolve(true);
			} catch (error) {
				reject(error);
			}
		});
	}
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
		return this.commitDb(
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
