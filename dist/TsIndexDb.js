"use strict";
/*
 * @Description: TsIndexDb - TypeScript IndexedDB 封装库
 * @Author: 小白
 * @Date: 2020-04-08 21:25:02
 * @LastEditors: Kilo
 * @LastEditTime: 2026-02-27
 * @Version: 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TsIndexDb = exports.IndexDbError = void 0;
// ======================== 错误类型 ========================
class IndexDbError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IndexDbError';
    }
}
exports.IndexDbError = IndexDbError;
// ======================== 主类 ========================
/** 任务队列最大长度，防止内存泄漏 */
const MAX_QUEUE_SIZE = 200;
class TsIndexDb {
    constructor({ dbName, version, tables }) {
        this.dbName = '';
        this.version = 1;
        this.tableList = [];
        this.db = null;
        /** 等待数据库就绪的任务队列 */
        this.queue = [];
        this.dbName = dbName;
        this.version = version;
        this.tableList = tables;
    }
    // ======================== 静态工厂方法 ========================
    /**
     * 获取或创建一个数据库实例（单例，按 dbName 隔离）
     * @param dbOptions 数据库配置，首次调用必须传入
     * @throws {IndexDbError} 首次调用未传入配置时抛出
     */
    static getInstance(dbOptions) {
        var _a;
        const key = (_a = dbOptions === null || dbOptions === void 0 ? void 0 : dbOptions.dbName) !== null && _a !== void 0 ? _a : '__default__';
        if (!TsIndexDb._instances.has(key)) {
            if (!dbOptions) {
                throw new IndexDbError('首次调用 getInstance() 必须传入 dbOptions 参数，或先通过 init() 初始化数据库。');
            }
            TsIndexDb._instances.set(key, new TsIndexDb(dbOptions));
        }
        return TsIndexDb._instances.get(key);
    }
    /**
     * 获取已有的数据库实例（不创建新实例）
     * @param dbName 数据库名称，不传则返回 __default__ 实例
     * @throws {IndexDbError} 实例不存在时抛出
     */
    static getExistingInstance(dbName) {
        const key = dbName !== null && dbName !== void 0 ? dbName : '__default__';
        const instance = TsIndexDb._instances.get(key);
        if (!instance) {
            throw new IndexDbError(`数据库 "${key}" 尚未初始化，请先调用 init() 或 getInstance(dbOptions)。`);
        }
        return instance;
    }
    /**
     * 获取所有已创建的实例名列表
     */
    static getInstanceNames() {
        return Array.from(TsIndexDb._instances.keys());
    }
    // ======================== 查询操作 ========================
    /**
     * 查询某张表的所有数据
     * @param tableName 表名
     */
    queryAll({ tableName }) {
        const res = [];
        return this.commitDb(tableName, (store) => store.openCursor(), 'readonly', (e, resolve) => {
            this.cursor_success(e, {
                condition: () => true,
                handler: ({ currentValue }) => res.push(currentValue),
                success: () => resolve(res),
            });
        });
    }
    /**
     * 条件查询（全表遍历过滤），返回满足条件的数组
     * @param tableName 表名
     * @param condition 过滤函数，类似 Array.filter
     */
    query({ tableName, condition, }) {
        const res = [];
        return this.commitDb(tableName, (store) => store.openCursor(), 'readonly', (e, resolve) => {
            this.cursor_success(e, {
                condition,
                handler: ({ currentValue }) => res.push(currentValue),
                success: () => resolve(res),
            });
        });
    }
    /**
     * 分页查询
     * @param options 分页参数 { tableName, page, pageSize, condition?, direction? }
     */
    queryByPage(options) {
        const { tableName, page, pageSize, condition, direction = 'next' } = options;
        if (page < 1 || pageSize < 1) {
            return Promise.reject(new IndexDbError('page 和 pageSize 必须大于 0'));
        }
        const offset = (page - 1) * pageSize;
        const list = [];
        let skipped = 0;
        let count = 0;
        return this.commitDb(tableName, (store) => store.openCursor(null, direction), 'readonly', (e, resolve) => {
            const cursor = e.target.result;
            if (!cursor) {
                resolve({ list, page, pageSize, hasMore: false });
                return;
            }
            const currentValue = cursor.value;
            const matches = !condition || condition(currentValue);
            if (matches) {
                if (skipped < offset) {
                    skipped++;
                    cursor.continue();
                    return;
                }
                if (count < pageSize) {
                    list.push(currentValue);
                    count++;
                    cursor.continue();
                    return;
                }
                // 已满一页，查看是否还有更多
                resolve({ list, page, pageSize, hasMore: true });
                return;
            }
            cursor.continue();
        });
    }
    /**
     * 根据索引字段精确查询单条数据
     * @param tableName 表名
     * @param key 索引字段名
     * @param value 索引字段值
     */
    query_by_keyValue({ tableName, key, value, }) {
        return this.commitDb(tableName, (store) => store.index(key).get(value), 'readonly', (e, resolve) => {
            var _a;
            resolve((_a = e.target.result) !== null && _a !== void 0 ? _a : null);
        });
    }
    /**
     * 根据主键查询单条数据
     * @param tableName 表名
     * @param value 主键值
     */
    query_by_primaryKey({ tableName, value, }) {
        return this.commitDb(tableName, (store) => store.get(value), 'readonly', (e, resolve) => {
            var _a;
            resolve((_a = e.target.result) !== null && _a !== void 0 ? _a : null);
        });
    }
    /**
     * 统计满足范围条件的记录数
     * @param tableName 表名
     * @param key 索引字段名（必须已建索引）
     * @param countCondition 范围条件
     *
     * @example
     * // key ≥ x
     * count({ tableName, key, countCondition: { type: 'gt', rangeValue: [x] } })
     * // key > x
     * count({ tableName, key, countCondition: { type: 'gt', rangeValue: [x, x, true] } })
     * // key ≥ x && ≤ y
     * count({ tableName, key, countCondition: { type: 'between', rangeValue: [x, y] } })
     * // key = z
     * count({ tableName, key, countCondition: { type: 'equal', rangeValue: [z] } })
     */
    count({ tableName, key, countCondition, }) {
        const mapCondition = {
            equal: IDBKeyRange.only,
            gt: IDBKeyRange.lowerBound,
            lt: IDBKeyRange.upperBound,
            between: IDBKeyRange.bound,
        };
        const range = mapCondition[countCondition.type](...countCondition.rangeValue.filter((v) => v !== undefined));
        return this.commitDb(tableName, (store) => store.index(key).count(range), 'readonly', (e, resolve) => {
            var _a;
            resolve((_a = e.target.result) !== null && _a !== void 0 ? _a : 0);
        });
    }
    // ======================== 更新操作 ========================
    /**
     * 按条件批量更新数据（遍历所有记录，满足条件的执行 handle）
     * @param tableName 表名
     * @param condition 判断是否需要更新的函数
     * @param handle 处理函数，接收当前数据，返回修改后的数据
     */
    update({ tableName, condition, handle, }) {
        const res = [];
        return this.commitDb(tableName, (store) => store.openCursor(), 'readwrite', (e, resolve) => {
            this.cursor_success(e, {
                condition,
                handler: ({ currentValue, cursor }) => {
                    const updated = handle(currentValue);
                    res.push(updated);
                    cursor.update(updated);
                },
                success: () => resolve(res),
            });
        });
    }
    /**
     * 按主键更新单条数据
     * @param tableName 表名
     * @param value 主键值
     * @param handle 处理函数，接收当前数据，返回修改后的数据
     */
    update_by_primaryKey({ tableName, value, handle, }) {
        return this.commitDb(tableName, (store) => store.get(value), 'readwrite', (e, resolve, store) => {
            const current = e.target.result;
            if (!current) {
                resolve(null);
                return;
            }
            const updated = handle(current);
            store.put(updated);
            resolve(updated);
        });
    }
    // ======================== 插入操作 ========================
    /**
     * 插入单条或多条数据（数组时批量插入，等待所有写入完成后 resolve）
     * @param tableName 表名
     * @param data 数据对象或数组
     */
    insert({ tableName, data }) {
        return new Promise((resolve, reject) => {
            const task = () => {
                try {
                    if (!this.db) {
                        reject(new IndexDbError('请先调用 open_db() 开启数据库'));
                        return;
                    }
                    const transaction = this.db.transaction(tableName, 'readwrite');
                    const store = transaction.objectStore(tableName);
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = (e) => reject(e);
                    transaction.onabort = (e) => reject(e);
                    const items = data instanceof Array ? data : [data];
                    for (const item of items) {
                        store.put(item);
                    }
                }
                catch (error) {
                    reject(error);
                }
            };
            if (!this.db) {
                if (this.queue.length >= MAX_QUEUE_SIZE) {
                    reject(new IndexDbError(`任务队列已满（最大 ${MAX_QUEUE_SIZE}），请等待数据库连接后再操作。`));
                    return;
                }
                this.queue.push(task);
            }
            else {
                task();
            }
        });
    }
    // ======================== 删除操作 ========================
    /**
     * 按条件批量删除数据（遍历所有记录，满足条件的删除）
     * @param tableName 表名
     * @param condition 判断是否需要删除的函数
     */
    delete({ tableName, condition, }) {
        const res = [];
        return this.commitDb(tableName, (store) => store.openCursor(), 'readwrite', (e, resolve) => {
            this.cursor_success(e, {
                condition,
                handler: ({ currentValue, cursor }) => {
                    res.push(currentValue);
                    cursor.delete();
                },
                success: () => resolve(res),
            });
        });
    }
    /**
     * 按主键删除单条数据
     * @param tableName 表名
     * @param value 主键值
     */
    delete_by_primaryKey({ tableName, value, }) {
        return this.commitDb(tableName, (store) => store.delete(value), 'readwrite', (_e, resolve) => {
            resolve();
        });
    }
    /**
     * 批量按主键删除多条数据
     * @param tableName 表名
     * @param values 主键值数组
     */
    delete_by_primaryKeys({ tableName, values, }) {
        return new Promise((resolve, reject) => {
            const task = () => {
                try {
                    if (!this.db) {
                        reject(new IndexDbError('请先调用 open_db() 开启数据库'));
                        return;
                    }
                    const transaction = this.db.transaction(tableName, 'readwrite');
                    const store = transaction.objectStore(tableName);
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = (e) => reject(e);
                    transaction.onabort = (e) => reject(e);
                    for (const value of values) {
                        store.delete(value);
                    }
                }
                catch (error) {
                    reject(error);
                }
            };
            if (!this.db) {
                if (this.queue.length >= MAX_QUEUE_SIZE) {
                    reject(new IndexDbError(`任务队列已满（最大 ${MAX_QUEUE_SIZE}），请等待数据库连接后再操作。`));
                    return;
                }
                this.queue.push(task);
            }
            else {
                task();
            }
        });
    }
    // ======================== 数据库管理 ========================
    /**
     * 打开数据库，返回当前实例
     */
    open_db() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(this.dbName, this.version);
            request.onerror = (e) => {
                reject(e);
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                // 清空队列，执行所有等待的任务
                let task;
                while ((task = this.queue.shift())) {
                    task();
                }
                resolve(this);
            };
            // 数据库创建或版本升级时触发
            request.onupgradeneeded = (e) => {
                const idb = e.target.result;
                this.tableList.forEach((element) => {
                    this.create_table(idb, element);
                });
            };
        });
    }
    /**
     * 关闭数据库连接并清除当前实例
     * @throws {IndexDbError} 数据库未开启时抛出
     */
    close_db() {
        return new Promise((resolve, reject) => {
            try {
                if (!this.db) {
                    reject(new IndexDbError('数据库未开启，无需关闭。'));
                    return;
                }
                // 清空队列，避免内存泄漏
                this.queue.length = 0;
                this.db.close();
                this.db = null;
                // 从实例 Map 中移除
                TsIndexDb._instances.delete(this.dbName);
                resolve();
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * 删除整个数据库
     * @param name 数据库名称
     */
    delete_db(name) {
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
     * 清空指定表的所有数据（保留表结构）
     * @param tableName 表名
     */
    delete_table(tableName) {
        return this.commitDb(tableName, (store) => store.clear(), 'readwrite', (_e, resolve) => {
            resolve();
        });
    }
    /**
     * 在单个事务中执行多个操作（原子性保障）
     * @param tableName 表名
     * @param mode 事务模式
     * @param operations 操作函数列表，接收 store 并返回 IDBRequest 数组
     */
    transaction(tableName, mode, operations) {
        return new Promise((resolve, reject) => {
            const task = () => {
                try {
                    if (!this.db) {
                        reject(new IndexDbError('请先调用 open_db() 开启数据库'));
                        return;
                    }
                    const tx = this.db.transaction(tableName, mode);
                    const store = tx.objectStore(tableName);
                    const results = [];
                    let pendingCount = 0;
                    tx.oncomplete = () => resolve(results);
                    tx.onerror = (e) => reject(e);
                    tx.onabort = (e) => reject(e);
                    const requests = operations(store);
                    pendingCount = requests.length;
                    if (pendingCount === 0) {
                        resolve(results);
                        return;
                    }
                    requests.forEach((req, index) => {
                        req.onsuccess = (e) => {
                            results[index] = e.target.result;
                        };
                        req.onerror = (e) => reject(e);
                    });
                }
                catch (error) {
                    reject(error);
                }
            };
            if (!this.db) {
                if (this.queue.length >= MAX_QUEUE_SIZE) {
                    reject(new IndexDbError(`任务队列已满（最大 ${MAX_QUEUE_SIZE}），请等待数据库连接后再操作。`));
                    return;
                }
                this.queue.push(task);
            }
            else {
                task();
            }
        });
    }
    // ======================== 私有方法 ========================
    /**
     * 创建 ObjectStore 和索引（仅在 onupgradeneeded 中调用）
     */
    create_table(idb, { tableName, option, indexs = [] }) {
        if (!idb.objectStoreNames.contains(tableName)) {
            const store = idb.createObjectStore(tableName, option);
            for (const { key, option: indexOption } of indexs) {
                store.createIndex(key, key, indexOption);
            }
        }
    }
    /**
     * 核心事务封装：统一处理任务排队、事务建立、请求发起和回调
     */
    commitDb(tableName, commit, mode = 'readwrite', backF) {
        return new Promise((resolve, reject) => {
            const task = () => {
                try {
                    if (!this.db) {
                        reject(new IndexDbError('请先调用 open_db() 开启数据库'));
                        return;
                    }
                    const store = this.db.transaction(tableName, mode).objectStore(tableName);
                    if (!commit) {
                        // insert 等不需要 IDBRequest 的操作直接调用 backF
                        backF(null, resolve, store);
                        return;
                    }
                    const req = commit(store);
                    req.onsuccess = (e) => {
                        if (backF) {
                            backF(e, resolve, store);
                        }
                        else {
                            resolve(e);
                        }
                    };
                    req.onerror = (e) => {
                        reject(e);
                    };
                }
                catch (error) {
                    reject(error);
                }
            };
            if (!this.db) {
                if (this.queue.length >= MAX_QUEUE_SIZE) {
                    reject(new IndexDbError(`任务队列已满（最大 ${MAX_QUEUE_SIZE}），请等待数据库连接后再操作。`));
                    return;
                }
                this.queue.push(task);
            }
            else {
                task();
            }
        });
    }
    /**
     * 游标遍历处理器（类型安全版本）
     * @param e IDBRequest 的 onsuccess 事件
     * @param options 遍历选项
     */
    cursor_success(e, options) {
        const { condition, handler, success } = options;
        const cursor = e.target.result;
        if (cursor) {
            const currentValue = cursor.value;
            if (condition(currentValue)) {
                handler({ cursor, currentValue });
            }
            cursor.continue();
        }
        else {
            success();
        }
    }
}
exports.TsIndexDb = TsIndexDb;
/** 单例 Map，支持多数据库实例 */
TsIndexDb._instances = new Map();
//# sourceMappingURL=TsIndexDb.js.map