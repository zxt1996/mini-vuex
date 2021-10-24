import applyMixin from "./mixin";
import ModuleCollection from './module/module-collection';

/**
 * 安装模块
 * @param {*} store       容器
 * @param {*} rootState   根状态
 * @param {*} path        所有路径
 * @param {*} module      格式化后的模块对象
 */
 const installModule = (store, rootState, path, module) => {

    // 遍历当前模块中的 actions、mutations、getters 
    // 将它们分别定义到 store 中的 _actions、_mutations、_wrappedGetters;
  
    // 遍历 mutation
    module.forEachMutation((mutation, key) => {
      // 处理成为数组类型：每个 key 可能会存在多个需要被处理的函数
      store._mutations[key] = (store._mutations[key] || []);
      // 向 _mutations 对应 key 的数组中，放入对应的处理函数
      store._mutations[key].push((payload) => {
        // 执行 mutation，传入当前模块的 state 状态
        mutation.call(store, module.state, payload);
      })
    })
    // 遍历 action
    module.forEachAction((action, key) => {
      store._actions[key] = (store._actions[key] || []);
      store._actions[key].push((payload) => {
        action.call(store, store, payload);
      })
    })
    // 遍历 getter
    module.forEachGetter((getter, key) => {
      // 注意：getter 重名将会被覆盖
      store._wrappedGetters[key] = function () {
        // 执行对应的 getter 方法，传入当前模块的 state 状态，返回执行结果
        return getter(module.state)   
      }
    })
    // 遍历当前模块的儿子
    module.forEachChild((child, key) => {
      // 递归安装/加载子模块
      installModule(store, rootState, path.concat(key), child);
    })
  }

// 容器初始化
export class Store {
    constructor(options) {  // options:{state, mutation, actions}
        const state = options.state;  // 获取 options 选项中的 state 对象

        // 获取 options 选项中的 getters 对象：内部包含多个方法
        const getters = options.getters;
        // 声明 store 实例中的 getters 对象
        this.getters = {};
        // 将 options.getters 中的方法定义到计算属性中
        const computed = {};

        // 将用户传入的 options.getters 属性中的方法,转变成为 store 实例中的 getters 对象上对应的属性
        Object.keys(getters).forEach(key => {
            // 将 options.getters 中定义的方法，放入计算属性 computed 中，即定义在 Vue 的实例 _vm 上
            computed[key] = () => {
                return getters[key](this.state);
            }

            // 将 options.getters 中定义的方法，放入store 实例中的 getters 对象中
            Object.defineProperty(this.getters, key, {
                // 取值操作时,执行计算属性逻辑
                get: () => this._vm[key]
            })
        })

        // 声明 store 实例中的 mutations 对象
        this.mutations = {};
        // 获取 options 选项中的 mutations 对象
        const mutations = options.mutations;

        // 将 options.mutations 中定义的方法，绑定到 store 实例中的 mutations 对象
        Object.keys(mutations).forEach(key => {
            // payload：commit 方法中调用 store 实例中的 mutations 方法时传入
            this.mutations[key] = (payload) => mutations[key](this.state, payload);
        });

        /**
        * 通过 type 找到 store 实例的 mutations 对象中对应的方法，并执行
        *    用户可能会解构使用{ commit }, 也有可能在页面使用 $store.commit，
        *    所以，在实际执行时，this是不确定的，{ commit } 写法 this 为空，
        *    使用箭头函数：确保 this 指向 store 实例；
        * @param {*} type mutation 方法名
        * @param {*} payload 载荷：值或对象
         */
        this.commit = (type, payload) => {
            this.mutations[type](payload);
        }

        // 声明 store 实例中的 actions 对象
        this.actions = {};
        // 获取 options 选项中的 actions 对象
        const actions = options.actions;

        // 将 options.actions 中定义的方法，绑定到 store 实例中的 actions 对象
        Object.keys(actions).forEach(key => {
            // payload:dispatch 方法中调用 store 实例中的 actions 方法时传入
            this.actions[key] = (payload) => actions[key](this, payload);
        })

        /**
         * 通过 type 找到 store 实例的 actions 对象中对应的方法，并执行
         *    用户可能会解构使用{ dispatch }, 也有可能在页面使用 $store.dispatch,
         *    所以，在实际执行时，this 是不确定的，{ dispatch } 写法 this 为空，
         *    使用箭头函数：确保 this 指向 store 实例；
         * @param {*} type action 方法名
         * @param {*} payload 载荷：值或对象
         */
        this.dispatch = (type, payload) => {
            // 执行 actions 对象中对应的方法，并传入 payload 执行
            this.actions[type](payload);
        }

        this._actions = {};
        this._mutations = {};
        this._wrappedGetters = {};

        this._modules = new ModuleCollection(options);

        installModule(this, state, [], this._modules.root);

        // 响应式数据：new Vue({data})
        // vuex 中 state 状态的响应式是借助了 Vue 来实现的
        this._vm = new Vue({
            data: {
                // 在 data 中，默认不会将以$开头的属性挂载到 vm 上
                $$state: state  // $$state 对象将通过 defineProperty 进行属性劫持
            },
            computed  // 将 options.getters 定义到 computed 实现数据缓存
        })


    }

    // 相当于 Object.defineProperty({}) 中的 getter
    get state() { // 对外提供属性访问器：当访问state时，实际是访问 _vm._data.$$state
        return this._vm._data.$$state;
    }
}

// 导出传入的 Vue 的构造函数，供插件内部的其他文件使用
export let Vue;

/**
 * 插件安装逻辑：当 Vue.use(Vuex) 时执行
 * @param {*} _Vue Vue 的构造函数
 */
export const install = (_Vue) => {
    Vue = _Vue;
    applyMixin(Vue);
}