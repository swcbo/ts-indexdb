export declare type IIndexDb = {
    dbName: string;
    version: number;
    tables: DbTable[];
};
export declare type DbIndex = {
    key: string;
    option?: IDBIndexParameters;
};
export declare type DbTable = {
    tableName: string;
    option?: IDBObjectStoreParameters;
    indexs: DbIndex[];
};
export interface DbOperate<T> {
    tableName: string;
    key: string;
    data: T | T[];
    value: string | number;
    condition(data: T): boolean;
    success(res: T[] | T): void;
    handle(res: T): void;
}
export declare class TsIndexDb {
    private dbName;
    private version;
    private tableList;
    private db;
    constructor({ dbName, version, tables }: IIndexDb);
    private static _instance;
    static getInstance(dbOptions?: IIndexDb): TsIndexDb;
    /**
     * @method 查询某张表的所有数据(返回具体数组)
     * @param {Object}
     *   @property {String} tableName 表名
     */
    queryAll<T>({ tableName }: Pick<DbOperate<T>, 'tableName'>): Promise<T[]>;
    /**
     * @method 查询(返回具体数组)
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Function} condition 查询的条件
     * */
    query<T>({ tableName, condition }: Pick<DbOperate<T>, 'condition' | 'tableName'>): Promise<T[]>;
    /**
     * @method 查询数据(更具表具体属性)返回具体某一个
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Number|String} key 名
     *   @property {Number|String} value 值
     *
     * */
    query_by_keyValue<T>({ tableName, key, value }: Pick<DbOperate<T>, 'tableName' | 'key' | 'value'>): Promise<T>;
    /**
     * @method 查询数据（主键值）
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Number|String} value 主键值
     *
     * */
    query_by_primaryKey<T>({ tableName, value }: Pick<DbOperate<T>, 'tableName' | 'value'>): Promise<T>;
    /**
     * @method 修改数据(返回修改的数组)
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Function} condition 查询的条件，遍历，与filter类似
     *      @arg {Object} 每个元素
     *      @return 条件
     *   @property {Function} handle 处理函数，接收本条数据的引用，对其修改
     * */
    update<T>({ tableName, condition, handle }: Pick<DbOperate<T>, 'tableName' | 'condition' | 'handle'>): Promise<T>;
    /**
    * @method 修改某条数据(主键)返回修改的对象
    * @param {Object}
    *   @property {String} tableName 表名
    *   @property {String\|Number} value 目标主键值
    *   @property {Function} handle 处理函数，接收本条数据的引用，对其修改
    * */
    update_by_primaryKey<T>({ tableName, value, handle }: Pick<DbOperate<T>, 'tableName' | 'value' | 'handle'>): Promise<T>;
    /**
     * @method 增加数据
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Object} data 插入的数据
     * */
    insert<T>({ tableName, data }: Pick<DbOperate<T>, 'tableName' | 'data'>): Promise<T>;
    /**
     * @method 删除数据(返回删除数组)
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {Function} condition 查询的条件，遍历，与filter类似
     *      @arg {Object} 每个元素
     *      @return 条件
     * */
    delete<T>({ tableName, condition }: Pick<DbOperate<T>, 'tableName' | 'condition'>): Promise<T>;
    /**
     * @method 删除数据(主键)
     * @param {Object}
     *   @property {String} tableName 表名
     *   @property {String\|Number} value 目标主键值
     * */
    delete_by_primaryKey<T>({ tableName, value }: Pick<DbOperate<T>, 'tableName' | 'value'>): Promise<T>;
    /**
     * @method 打开数据库
     */
    open_db(): Promise<TsIndexDb>;
    /**
        *@method 关闭数据库
        * @param  {[type]} db [数据库名称]
        */
    close_db(): Promise<unknown>;
    /**
     * @method 删除数据库
     * @param {String}name 数据库名称
     */
    delete_db(name: string): Promise<unknown>;
    /**
    * @method 删除表数据
    * @param {String}name 数据库名称
    */
    delete_table(tableName: string): Promise<unknown>;
    /**
     * 创建table
     * @option<Object>  keyPath指定主键 autoIncrement是否自增
     * @index 索引配置
     * */
    private create_table;
    /**
     * 提交Db请求
     * @param tableName  表名
     * @param commit 提交具体函数
     * @param mode 事物方式
     * @param backF 游标方法
     */
    private commitDb;
    /**
    * @method 游标开启成功,遍历游标
    * @param {Function} 条件
    * @param {Function} 满足条件的处理方式 @arg {Object} @property cursor游标 @property currentValue当前值
    * @param {Function} 游标遍历完执行的方法
    * @return {Null}
    * */
    cursor_success(e: any, { condition, handler, success }: any): void;
}
