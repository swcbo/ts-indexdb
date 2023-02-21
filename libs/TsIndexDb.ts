/*
 * @Description: file content
 * @Author: 小白
 * @Date: 2020-04-08 21:25:02
 * @LastEditors: 小白
 * @LastEditTime: 2020-04-10 14:40:36
 */
export type IIndexDb = {
    dbName: string
    version: number
    tables: DbTable[]
}
export type DbIndex = { key: string, option?: IDBIndexParameters }
export type DbTable = {
    tableName: string,
    option?: IDBObjectStoreParameters
    indexs: DbIndex[]
}
export type AtleastOne<T, U = { [K in keyof T]:Pick<T,K> }> = Partial<T>&U[keyof U]
interface MapCondition {
    equal: (value:any)=>IDBKeyRange,
    gt: (lower: any, open?: boolean)=>IDBKeyRange,
    lt: (upper: any, open?: boolean)=>IDBKeyRange,
    between: (lower: any, upper: any, lowerOpen?: boolean, upperOpen?: boolean)=>IDBKeyRange,
}
export interface DbOperate<T> {
    tableName: string,
    key: string,
    data: T | T[],
    value: string | number,
    countCondition: {type: 'equal'|'gt'|'lt'|'between',rangeValue: [any,any?,any?,any?]},
    condition(data: T): boolean
    success(res: T[] | T): void
    handle(res: T): void

}

export class TsIndexDb {

    private dbName: string = '';//数据库名称
    private version: number = 1;//数据库版本
    private tableList: DbTable[] = [];//表单列表
    private db: IDBDatabase | null = null;
    private queue: (() => void)[] = []; //事务队列，实例化一次以后下次打开页面时数据库自启动
    constructor({ dbName, version, tables }: IIndexDb) {
        this.dbName = dbName;
        this.version = version;
        this.tableList = tables;
    }

    private static _instance: TsIndexDb | null = null;

    public static getInstance(dbOptions?: IIndexDb): TsIndexDb {
        if (TsIndexDb._instance === null && dbOptions) {
            TsIndexDb._instance = new TsIndexDb(dbOptions);
        }
        return TsIndexDb._instance!;
    }




    //=================relate select================================
    /**
     * @method 查询某张表的所有数据(返回具体数组)
     * @param {Object}
     *   @property {String} tableName 表名
     */
    queryAll<T>({ tableName }: Pick<DbOperate<T>, 'tableName'>) {
        let res: T[] = [];
        return this.commitDb<T[]>(tableName, (transaction: IDBObjectStore) => transaction.openCursor(), 'readonly', (e: any, resolve: (data: T[]) => void) => {
            this.cursor_success(e, {
                condition: () => true,
                handler: ({ currentValue }: any) => res.push(currentValue),
                success: () => resolve(res)
            })
        })
    }

    /**
     * @method 查询(返回具体数组)
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Function} condition 查询的条件
     * */
    query<T>({ tableName, condition }: Pick<DbOperate<T>, 'condition' | 'tableName'>) {
        let res: T[] = [];
        return this.commitDb<T[]>(tableName, (transaction: IDBObjectStore) => transaction.openCursor(), 'readonly', (e: any, resolve: (data: T[]) => void) => {
            this.cursor_success(e, {
                condition,
                handler: ({ currentValue }: any) => res.push(currentValue),
                success: () => resolve(res)
            })
        })
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
    count<T>({ tableName, key, countCondition }: Pick<DbOperate<T>, 'key' | 'tableName' | 'countCondition'>) {
        const mapCondition: MapCondition = {
            equal: IDBKeyRange.only,
            gt: IDBKeyRange.lowerBound,
            lt: IDBKeyRange.upperBound,
            between: IDBKeyRange.bound,
        }
        return this.commitDb<T>(tableName, (transaction: IDBObjectStore) => transaction.index(key).count(mapCondition[countCondition.type](...countCondition.rangeValue)), 'readonly', (e: any, resolve: (data: T) => void) => {
            resolve(e.target.result || null);
        })
    }

    /**
     * @method 查询数据(更具表具体属性)返回具体某一个
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Number|String} key 名
     *   @property {Number|String} value 值
     *
     * */
    query_by_keyValue<T>({ tableName, key, value }: Pick<DbOperate<T>, 'tableName' | 'key' | 'value'>) {
        return this.commitDb<T>(tableName, (transaction: IDBObjectStore) => transaction.index(key).get(value), 'readonly', (e: any, resolve: (data: T) => void) => {
            resolve(e.target.result || null);
        })
    }

    /**
     * @method 查询数据（主键值）
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Number|String} value 主键值
     *
     * */
    query_by_primaryKey<T>({ tableName, value }: Pick<DbOperate<T>, 'tableName' | 'value'>) {
        return this.commitDb<T>(tableName, (transaction: IDBObjectStore) => transaction.get(value), 'readonly', (e: any, resolve: (data: T) => void) => {
            resolve(e.target.result || null);
        })
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
    update<T>({ tableName, condition, handle }: Pick<DbOperate<T>, 'tableName' | 'condition' | 'handle'>) {
        let res: T[] = [];
        return this.commitDb<T>(tableName, (transaction: IDBObjectStore) => transaction.openCursor(), 'readwrite', (e: any, resolve: (data: T[]) => void) => {
            this.cursor_success(e, {
                condition,
                handler: ({ currentValue, cursor }: any) => {
                    const value = handle(currentValue);
                    res.push(value as any);
                    cursor.update(value);
                },
                success: () => {
                    resolve(res);
                }
            })
        })
    }

    /**
    * @method 修改某条数据(主键)返回修改的对象
    * @param {Object}
    *   @property {String} tableName 表名
    *   @property {String\|Number} value 目标主键值
    *   @property {Function} handle 处理函数，接收本条数据的引用，对其修改
    * */
    update_by_primaryKey<T>({ tableName, value, handle }: Pick<DbOperate<T>, 'tableName' | 'value' | 'handle'>) {
        return this.commitDb<T>(tableName, (transaction: IDBObjectStore) => transaction.get(value), 'readwrite',
            (e: any, resolve: (data: T | null) => void, store: IDBObjectStore) => {
                const currentValue = e.target.result;
                if (!currentValue) {
                    resolve(null);
                    return
                }
                const value = handle(currentValue);
                store.put(value);
                resolve(value as any);
            });
    }

    //=================relate insert================================
    /**
     * @method 增加数据
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Object} data 插入的数据
     * */
    insert<T>({ tableName, data }: Pick<DbOperate<T>, 'tableName' | 'data'>) {
        return this.commitDb<T>(tableName, undefined, 'readwrite',
            (_: any, resolve: () => void, store: IDBObjectStore) => {
                data instanceof Array ? data.forEach(v => store.put(v)) : store.put(data);
                resolve();
            })

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
    delete<T>({ tableName, condition }: Pick<DbOperate<T>, 'tableName' | 'condition'>) {
        let res: T[] = [];
        return this.commitDb<T>(tableName, (transaction: IDBObjectStore) => transaction.openCursor(), 'readwrite', (e: any, resolve: (data: T[]) => void) => {
            this.cursor_success(e, {
                condition,
                handler: ({ currentValue, cursor }: any) => {
                    res.push(currentValue);
                    cursor.delete();
                },
                success: () => {
                    resolve(res);
                }
            })
        })
    }


    /**
     * @method 删除数据(主键)
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {String\|Number} value 目标主键值
     * */
    delete_by_primaryKey<T>({ tableName, value }: Pick<DbOperate<T>, 'tableName' | 'value'>) {
        return this.commitDb<T>(tableName, (transaction: IDBObjectStore) => transaction.delete(value), 'readwrite', (e: any, resolve: () => void) => {
            resolve()
        })
    }

    //=================relate db================================

    /**
     * @method 打开数据库
     */
    open_db() {
        return new Promise<TsIndexDb>((resolve, reject) => {
            const request = window.indexedDB.open(this.dbName, this.version);
            request.onerror = e => {
                reject(e);
            };
            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                let task: () => void;

                while (task = this.queue.pop() as any) {
                    task();
                }

                resolve(this);
            };
            //数据库升级
            request.onupgradeneeded = e => {
                this.tableList.forEach((element: DbTable) => {
                    this.create_table((e.target as any).result, element);
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
                    resolve('请开启数据库')
                    return
                }
                this.db!.close();
                this.db = null
                TsIndexDb._instance = null;
                resolve(true)
            } catch (error) {
                reject(error)
            }
        })

    }
    /**
     * @method 删除数据库
     * @param {String}name 数据库名称
     */
    delete_db(name: string) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onerror = e => {
                reject(e);
            };
            request.onsuccess = e => {
                resolve(e);
            };
        });
    }
    /**
    * @method 删除表数据
    * @param {String}name 数据库名称
    */
    delete_table(tableName: string) {
        return this.commitDb(tableName, (transaction: IDBObjectStore) => transaction.clear(), 'readwrite',
            (_: any, resolve: () => void) => {
                resolve();
            })
    }
    /**
     * 创建table
     * @option<Object>  keyPath指定主键 autoIncrement是否自增
     * @index 索引配置
     * */
    private create_table(idb: any, { tableName, option, indexs = [] }: DbTable) {

        if (!idb.objectStoreNames.contains(tableName)) {
            let store = idb.createObjectStore(tableName, option);
            for (let { key, option } of indexs) {
                store.createIndex(key, key, option);
            }
        }
    }


    /**
     * 提交Db请求
     * @param tableName  表名
     * @param commit 提交具体函数
     * @param mode 事物方式
     * @param backF 游标方法
     */
    private commitDb<T>(tableName: string,
        commit?: (transaction: IDBObjectStore) => IDBRequest<any>,
        mode: IDBTransactionMode = 'readwrite',
        backF?: (request: any, resolve: any, store: IDBObjectStore) => void) {
        return new Promise<T>((resolve, reject) => {
            const task = () => {
                try {
                    if (this.db) {
                        let store = this.db.transaction(tableName, mode).objectStore(tableName);
                        if (!commit) {
                            backF!(null, resolve, store);
                            return;
                        }
                        let res = commit(store);
                        res!.onsuccess = (e: any) => {
                            if (backF) {
                                backF(e, resolve, store);
                            } else {
                                resolve(e);
                            }
                        };
                        res!.onerror = (event) => {
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

    /**
    * @method 游标开启成功,遍历游标
    * @param {Function} 条件
    * @param {Function} 满足条件的处理方式 @arg {Object} @property cursor游标 @property currentValue当前值
    * @param {Function} 游标遍历完执行的方法
    * @return {Null}
    * */
    cursor_success(e: any, { condition, handler, success }: any):void {
        const cursor: IDBCursorWithValue = e.target.result;
        if (cursor) {
            const currentValue = cursor.value;
            if (condition(currentValue)) handler({ cursor, currentValue });
            cursor.continue();
        } else {
            success();
        }
    }
}
