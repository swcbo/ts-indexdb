/*
 * @Description: file content
 * @Author: 小白
 * @Date: 2020-04-08 21:25:02
 * @LastEditors: 小白
 * @LastEditTime: 2020-04-09 11:17:44
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
export interface DbOperate<T> {
    tableName: string,
    key: string,
    data: T | T[],
    value: string | number,
    condition(data: T): boolean
    success(res: T[] | T): void
    handle(res: T): void

}

export class TsIndexDb {

    private dbName: string = '';//数据库名称
    private version: number = 1;//数据库版本
    private tableList: DbTable[] = [];//表单列表
    private idb: IDBDatabase | null = null;
    private db: IDBDatabase | null = null;
    constructor({ dbName, version, tables }: IIndexDb) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.idb = null;
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
                    handle(currentValue);
                    res.push(currentValue);
                    cursor.update(currentValue);
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
                handle(currentValue);
                store.put(currentValue);
                resolve(currentValue);
            })
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
                this.db = event.target.result
                resolve(this);
            };
            //数据库升级
            request.onupgradeneeded = (event: any) => {
                this.idb = event.target.result;
                this.tableList.forEach((element: DbTable) => {
                    this.create_table(this.idb!, element);
                });
            };
        });
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
    private create_table({ objectStoreNames, createObjectStore }: IDBDatabase, { tableName, option, indexs = [] }: DbTable) {
        if (!objectStoreNames.contains(tableName)) {
            let store = createObjectStore(tableName, option);
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
            try {
                if (this.db) {
                    let store = this.db.transaction(tableName, mode).objectStore(tableName);
                    if (!commit) {
                        backF!(null, resolve, store)
                        return
                    }
                    let res = commit(store)
                    res!.onsuccess = (e: any) => {
                        if (backF) {
                            backF(e, resolve, store)
                        } else {
                            resolve(e)
                        }
                    }
                    res!.onerror = (event) => {
                        reject(event)
                    }

                } else {
                    reject(new Error('请开启数据库'))
                }
            } catch (error) {
                reject(error)
            }

        })
    }

    /**
    * @method 游标开启成功,遍历游标
    * @param {Function} 条件
    * @param {Function} 满足条件的处理方式 @arg {Object} @property cursor游标 @property currentValue当前值
    * @param {Function} 游标遍历完执行的方法
    * @return {Null}
    * */
    cursor_success(e: any, { condition, handler, success }: any) {
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
