"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TsIndexDb {
    constructor({ dbName, version, tables }) {
        this.dbName = ''; //数据库名称
        this.version = 1; //数据库版本
        this.tableList = []; //表单列表
        this.db = null;
        this.queue = []; //事务队列，实例化一次以后下次打开页面时数据库自启动
        this.dbName = dbName;
        this.version = version;
        this.tableList = tables;
    }
    static getInstance(dbOptions) {
        if (TsIndexDb._instance === null && dbOptions) {
            TsIndexDb._instance = new TsIndexDb(dbOptions);
        }
        return TsIndexDb._instance;
    }
    //=================relate select================================
    /**
     * @method 查询某张表的所有数据(返回具体数组)
     * @param {Object}
     *   @property {String} tableName 表名
     */
    queryAll({ tableName }) {
        let res = [];
        return this.commitDb(tableName, (transaction) => transaction.openCursor(), 'readonly', (e, resolve) => {
            this.cursor_success(e, {
                condition: () => true,
                handler: ({ currentValue }) => res.push(currentValue),
                success: () => resolve(res)
            });
        });
    }
    /**
     * @method 查询(返回具体数组)
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Function} condition 查询的条件
     * */
    query({ tableName, condition }) {
        let res = [];
        return this.commitDb(tableName, (transaction) => transaction.openCursor(), 'readonly', (e, resolve) => {
            this.cursor_success(e, {
                condition,
                handler: ({ currentValue }) => res.push(currentValue),
                success: () => resolve(res)
            });
        });
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
    count({ tableName, key, countCondition }) {
        const mapCondition = {
            equal: IDBKeyRange.only,
            gt: IDBKeyRange.lowerBound,
            lt: IDBKeyRange.upperBound,
            between: IDBKeyRange.bound,
        };
        return this.commitDb(tableName, (transaction) => transaction.index(key).count(mapCondition[countCondition.type](...countCondition.rangeValue)), 'readonly', (e, resolve) => {
            resolve(e.target.result || null);
        });
    }
    /**
     * @method 查询数据(更具表具体属性)返回具体某一个
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Number|String} key 名
     *   @property {Number|String} value 值
     *
     * */
    query_by_keyValue({ tableName, key, value }) {
        return this.commitDb(tableName, (transaction) => transaction.index(key).get(value), 'readonly', (e, resolve) => {
            resolve(e.target.result || null);
        });
    }
    /**
     * @method 查询数据（主键值）
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Number|String} value 主键值
     *
     * */
    query_by_primaryKey({ tableName, value }) {
        return this.commitDb(tableName, (transaction) => transaction.get(value), 'readonly', (e, resolve) => {
            resolve(e.target.result || null);
        });
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
    update({ tableName, condition, handle }) {
        let res = [];
        return this.commitDb(tableName, (transaction) => transaction.openCursor(), 'readwrite', (e, resolve) => {
            this.cursor_success(e, {
                condition,
                handler: ({ currentValue, cursor }) => {
                    const value = handle(currentValue);
                    res.push(value);
                    cursor.update(value);
                },
                success: () => {
                    resolve(res);
                }
            });
        });
    }
    /**
    * @method 修改某条数据(主键)返回修改的对象
    * @param {Object}
    *   @property {String} tableName 表名
    *   @property {String\|Number} value 目标主键值
    *   @property {Function} handle 处理函数，接收本条数据的引用，对其修改
    * */
    update_by_primaryKey({ tableName, value, handle }) {
        return this.commitDb(tableName, (transaction) => transaction.get(value), 'readwrite', (e, resolve, store) => {
            const currentValue = e.target.result;
            if (!currentValue) {
                resolve(null);
                return;
            }
            const value = handle(currentValue);
            store.put(value);
            resolve(value);
        });
    }
    //=================relate insert================================
    /**
     * @method 增加数据
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Object} data 插入的数据
     * */
    insert({ tableName, data }) {
        return this.commitDb(tableName, undefined, 'readwrite', (_, resolve, store) => {
            data instanceof Array ? data.forEach(v => store.put(v)) : store.put(data);
            resolve();
        });
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
    delete({ tableName, condition }) {
        let res = [];
        return this.commitDb(tableName, (transaction) => transaction.openCursor(), 'readwrite', (e, resolve) => {
            this.cursor_success(e, {
                condition,
                handler: ({ currentValue, cursor }) => {
                    res.push(currentValue);
                    cursor.delete();
                },
                success: () => {
                    resolve(res);
                }
            });
        });
    }
    /**
     * @method 删除数据(主键)
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {String\|Number} value 目标主键值
     * */
    delete_by_primaryKey({ tableName, value }) {
        return this.commitDb(tableName, (transaction) => transaction.delete(value), 'readwrite', (e, resolve) => {
            resolve();
        });
    }
    //=================relate db================================
    /**
     * @method 打开数据库
     */
    open_db() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(this.dbName, this.version);
            request.onerror = e => {
                reject(e);
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                let task;
                while (task = this.queue.pop()) {
                    task();
                }
                resolve(this);
            };
            //数据库升级
            request.onupgradeneeded = e => {
                this.tableList.forEach((element) => {
                    this.create_table(e.target.result, element);
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
                this.db.close();
                this.db = null;
                TsIndexDb._instance = null;
                resolve(true);
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * @method 删除数据库
     * @param {String}name 数据库名称
     */
    delete_db(name) {
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
    delete_table(tableName) {
        return this.commitDb(tableName, (transaction) => transaction.clear(), 'readwrite', (_, resolve) => {
            resolve();
        });
    }
    /**
     * 创建table
     * @option<Object>  keyPath指定主键 autoIncrement是否自增
     * @index 索引配置
     * */
    create_table(idb, { tableName, option, indexs = [] }) {
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
    commitDb(tableName, commit, mode = 'readwrite', backF) {
        return new Promise((resolve, reject) => {
            const task = () => {
                try {
                    if (this.db) {
                        let store = this.db.transaction(tableName, mode).objectStore(tableName);
                        if (!commit) {
                            backF(null, resolve, store);
                            return;
                        }
                        let res = commit(store);
                        res.onsuccess = (e) => {
                            if (backF) {
                                backF(e, resolve, store);
                            }
                            else {
                                resolve(e);
                            }
                        };
                        res.onerror = (event) => {
                            reject(event);
                        };
                    }
                    else {
                        reject(new Error('请开启数据库'));
                    }
                }
                catch (error) {
                    reject(error);
                }
            };
            if (!this.db) {
                this.queue.push(task);
            }
            else {
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
    cursor_success(e, { condition, handler, success }) {
        const cursor = e.target.result;
        if (cursor) {
            const currentValue = cursor.value;
            if (condition(currentValue))
                handler({ cursor, currentValue });
            cursor.continue();
        }
        else {
            success();
        }
    }
}
exports.TsIndexDb = TsIndexDb;
TsIndexDb._instance = null;
