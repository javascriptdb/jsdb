export function readStreamToPromise(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
        stream.on('error', reject);
    });
}

const regexpIsoDate = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/;

export function parseData(dataString) {
    return JSON.parse(dataString, (key, value) => {
        if(regexpIsoDate.test(value)) {
            return new Date(value);
        } else {
            return value;
        }
    });
}