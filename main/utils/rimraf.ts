import * as rimraf from "rimraf"

export function rimrafAsync(path:string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        rimraf(path, error => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        })
    });
}