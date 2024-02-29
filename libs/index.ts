/*
 * @Description: file content
 * @Author: 小白
 * @Date: 2020-04-08 21:24:32
 * @LastEditors: 小白
 * @LastEditTime: 2020-04-10 09:13:06
 */

import { IndexDB } from './db';
import type { Options } from './types';

/**
 * @method 初始化函数
 */
export const init = (options: Options): Promise<IndexDB> => {
	return IndexDB.init(options);
};

/**
 * @method 获取单例的单个对象
 */
export const getInstance = () => IndexDB.getInstance();
