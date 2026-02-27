export type IIndexDb = {
    dbName: string;
    version: number;
    tables: DbTable[];
};
export type DbIndex = {
    key: string;
    option?: IDBIndexParameters;
};
export type DbTable = {
    tableName: string;
    option?: IDBObjectStoreParameters;
    indexs: DbIndex[];
};
export interface MapCondition {
    equal: (value: IDBValidKey | IDBKeyRange) => IDBKeyRange;
    gt: (lower: IDBValidKey | IDBKeyRange, open?: boolean) => IDBKeyRange;
    lt: (upper: IDBValidKey | IDBKeyRange, open?: boolean) => IDBKeyRange;
    between: (lower: IDBValidKey | IDBKeyRange, upper: IDBValidKey | IDBKeyRange, lowerOpen?: boolean, upperOpen?: boolean) => IDBKeyRange;
}
export type CountConditionType = 'equal' | 'gt' | 'lt' | 'between';
export interface DbOperate<T> {
    tableName: string;
    key: string;
    data: T | T[];
    value: string | number;
    countCondition: {
        type: CountConditionType;
        rangeValue: [IDBValidKey | IDBKeyRange, (IDBValidKey | IDBKeyRange)?, boolean?, boolean?];
    };
    condition(data: T): boolean;
    success(res: T[] | T): void;
    handle(res: T): T;
}
/** 分页查询参数 */
export interface PageQueryOptions<T> {
    tableName: string;
    page: number;
    pageSize: number;
    condition?: (data: T) => boolean;
    direction?: IDBCursorDirection;
}
/** 分页查询结果 */
export interface PageQueryResult<T> {
    list: T[];
    page: number;
    pageSize: number;
    hasMore: boolean;
}
export declare class IndexDbError extends Error {
    constructor(message: string);
}
export declare class TsIndexDb {
    private dbName;
    private version;
    private tableList;
    private db;
    /** 等待数据库就绪的任务队列 */
    private queue;
    /** 单例 Map，支持多数据库实例 */
    private static _instances;
    constructor({ dbName, version, tables }: IIndexDb);
    /**
     * 获取或创建一个数据库实例（单例，按 dbName 隔离）
     * @param dbOptions 数据库配置，首次调用必须传入
     * @throws {IndexDbError} 首次调用未传入配置时抛出
     */
    static getInstance(dbOptions?: IIndexDb): TsIndexDb;
    /**
     * 获取已有的数据库实例（不创建新实例）
     * @param dbName 数据库名称，不传则返回 __default__ 实例
     * @throws {IndexDbError} 实例不存在时抛出
     */
    static getExistingInstance(dbName?: string): TsIndexDb;
    /**
     * 获取所有已创建的实例名列表
     */
    static getInstanceNames(): string[];
    /**
     * 查询某张表的所有数据
     * @param tableName 表名
     */
    queryAll<T>({ tableName }: Pick<DbOperate<T>, 'tableName'>): Promise<T[]>;
    /**
     * 条件查询（全表遍历过滤），返回满足条件的数组
     * @param tableName 表名
     * @param condition 过滤函数，类似 Array.filter
     */
    query<T>({ tableName, condition, }: Pick<DbOperate<T>, 'condition' | 'tableName'>): Promise<T[]>;
    /**
     * 分页查询
     * @param options 分页参数 { tableName, page, pageSize, condition?, direction? }
     */
    queryByPage<T>(options: PageQueryOptions<T>): Promise<PageQueryResult<T>>;
    /**
     * 根据索引字段精确查询单条数据
     * @param tableName 表名
     * @param key 索引字段名
     * @param value 索引字段值
     */
    query_by_keyValue<T>({ tableName, key, value, }: Pick<DbOperate<T>, 'tableName' | 'key' | 'value'>): Promise<T | null>;
    /**
     * 根据主键查询单条数据
     * @param tableName 表名
     * @param value 主键值
     */
    query_by_primaryKey<T>({ tableName, value, }: Pick<DbOperate<T>, 'tableName' | 'value'>): Promise<T | null>;
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
    count<T>({ tableName, key, countCondition, }: Pick<DbOperate<T>, 'key' | 'tableName' | 'countCondition'>): Promise<number>;
    /**
     * 按条件批量更新数据（遍历所有记录，满足条件的执行 handle）
     * @param tableName 表名
     * @param condition 判断是否需要更新的函数
     * @param handle 处理函数，接收当前数据，返回修改后的数据
     */
    update<T>({ tableName, condition, handle, }: Pick<DbOperate<T>, 'tableName' | 'condition' | 'handle'>): Promise<T[]>;
    /**
     * 按主键更新单条数据
     * @param tableName 表名
     * @param value 主键值
     * @param handle 处理函数，接收当前数据，返回修改后的数据
     */
    update_by_primaryKey<T>({ tableName, value, handle, }: Pick<DbOperate<T>, 'tableName' | 'value' | 'handle'>): Promise<T | null>;
    /**
     * 插入单条或多条数据（数组时批量插入，等待所有写入完成后 resolve）
     * @param tableName 表名
     * @param data 数据对象或数组
     */
    insert<T>({ tableName, data }: Pick<DbOperate<T>, 'tableName' | 'data'>): Promise<void>;
    /**
     * 按条件批量删除数据（遍历所有记录，满足条件的删除）
     * @param tableName 表名
     * @param condition 判断是否需要删除的函数
     */
    delete<T>({ tableName, condition, }: Pick<DbOperate<T>, 'tableName' | 'condition'>): Promise<T[]>;
    /**
     * 按主键删除单条数据
     * @param tableName 表名
     * @param value 主键值
     */
    delete_by_primaryKey<T>({ tableName, value, }: Pick<DbOperate<T>, 'tableName' | 'value'>): Promise<void>;
    /**
     * 批量按主键删除多条数据
     * @param tableName 表名
     * @param values 主键值数组
     */
    delete_by_primaryKeys<T>({ tableName, values, }: {
        tableName: string;
        values: Array<string | number>;
    }): Promise<void>;
    /**
     * 打开数据库，返回当前实例
     */
    open_db(): Promise<TsIndexDb>;
    /**
     * 关闭数据库连接并清除当前实例
     * @throws {IndexDbError} 数据库未开启时抛出
     */
    close_db(): Promise<void>;
    /**
     * 删除整个数据库
     * @param name 数据库名称
     */
    delete_db(name: string): Promise<Event>;
    /**
     * 清空指定表的所有数据（保留表结构）
     * @param tableName 表名
     */
    delete_table(tableName: string): Promise<void>;
    /**
     * 在单个事务中执行多个操作（原子性保障）
     * @param tableName 表名
     * @param mode 事务模式
     * @param operations 操作函数列表，接收 store 并返回 IDBRequest 数组
     */
    transaction<T>(tableName: string, mode: IDBTransactionMode, operations: (store: IDBObjectStore) => IDBRequest[]): Promise<T[]>;
    /**
     * 创建 ObjectStore 和索引（仅在 onupgradeneeded 中调用）
     */
    private create_table;
    /**
     * 核心事务封装：统一处理任务排队、事务建立、请求发起和回调
     */
    private commitDb;
    /**
     * 游标遍历处理器（类型安全版本）
     * @param e IDBRequest 的 onsuccess 事件
     * @param options 遍历选项
     */
    private cursor_success;
}
//# sourceMappingURL=TsIndexDb.d.ts.map