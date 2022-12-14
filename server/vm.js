const cachedRuns = new Map();
import {VM} from "vm2";

export function memoizedRun(sandbox, expression) {
    const key = JSON.stringify(sandbox)+expression;
    if(cachedRuns.has(key)) {
        return cachedRuns.get(key)
    }
    const vm = new VM({
        timeout: 1000,
        allowAsync: false,
        sandbox,
    });
    const result = vm.run(expression);
    cachedRuns.set(key, result);
    return result;
}