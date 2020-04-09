/*
 * @Description: file content
 * @Author: 小白
 * @Date: 2020-04-08 21:24:32
 * @LastEditors: 小白
 * @LastEditTime: 2020-04-09 11:17:55
 */

import { TsIndexDb, IIndexDb } from "./TsIndexDb"
export const init = ({ dbName, version = new Date().getTime(), tables = [] }: IIndexDb): Promise<TsIndexDb> => {
    const db = TsIndexDb.getInstance({
        dbName,
        version,
        tables
    })
    return db.open_db()
}

export const getInstance = () => TsIndexDb.getInstance()

