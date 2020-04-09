<!--
 * @Description: file content
 * @Author: 小白
 * @Date: 2020-04-07 20:48:03
 * @LastEditors: 小白
 * @LastEditTime: 2020-04-09 11:34:53
 -->
# ts-indexDb
typescript对indexdb本地数据库的封装
### _安装：_
```
    npm install ts-indexDb --save
```
// let queryAll = await getInstance().queryAll<Rack>({
    //   tableName: 'bookrackList'
    // });
    // let query = await getInstance().query<Rack>({
    //   tableName: 'bookrackList',
    //   condition: item => item.id === 3
    // });
    // let query_by_keyValue = await getInstance().query_by_keyValue<Rack>({
    //   tableName: 'bookrackList',
    //   key: 'name',
    //   value: '我师兄实在太稳健了'
    // });
    // let query_by_primaryKey = await getInstance().query_by_primaryKey<Rack>({
    //   tableName: 'bookrackList',
    //   value: 3
    // });
    <!-- await getInstance().update<Rack>({
        tableName: 'bookrackList',
        condition: item => item.id === 8,
        handle: r => {
          r.name = '测试修改';
        }
      }) -->
       <!-- await getInstance().insert<Rack>({
        tableName: 'bookrackList',
        data: {
          name: '测试',
          coverUrl: '11111',
          readIndex: 1,
          origin: '3213',
          originName: '3123122',
          author: '312312',
          checked: false,
          tocUrl:"",
          bookChapterUrl:"",
          bookUrl:"",
          bookSourceUrl:""
        }
      }) -->

         <!-- await getInstance().delete<Rack>({
        tableName: 'bookrackList',
        condition: (item)=> item.name === '测试',
      }) -->
        <!-- await getInstance().delete_by_primaryKey<Rack>({
        tableName: 'bookrackList',
        value: 4
      }) -->

       <!-- await getInstance().delete_table('bookrackList') -->

       <!-- await getInstance().delete_db('bookrackList') -->