/*
 * @Description: file content
 * @Author: 小白
 * @Date: 2020-04-08 21:24:32
 * @LastEditors: 小白
 * @LastEditTime: 2020-04-10 09:13:06
 */

import { TsIndexDb, IIndexDb } from "./TsIndexDb"


// /**
//  * @method 初始化函数
//  * @param param0 
//  * @param isMany 
//  */
// export const initMany = (dbList: IIndexDb[]): Promise<TsIndexDb> => {
//     const db = TsIndexDb.getInstance({
//         dbName,
//         version,
//         tables
//     })
//     return db.open_db()
// }
/**
 * @method 初始化函数
 * @param param0 
 * @param isMany 
 */
export const init = ({ dbName, version = 1, tables = [] }: IIndexDb): Promise<TsIndexDb> => {
    const db = TsIndexDb.getInstance({
        dbName,
        version,
        tables
    })
    return db.open_db()
}

/**
 * @method 获取单例的单个对象
 */
export const getInstance = () => TsIndexDb.getInstance()



