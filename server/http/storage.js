const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const s3BucketUrl = process.env.S3_BUCKET_URL;

import { AwsV4Signer, AwsClient } from 'aws4fetch'

const client = new AwsClient({
  accessKeyId,
  secretAccessKey,
});

async function signUrl(path, method) {
  const url = new URL(`${s3BucketUrl}/${path}`);

  const signer = new AwsV4Signer({
    url,
    accessKeyId,
    secretAccessKey,
    method,
    headers: {
      "content-type": "application/json",
    },
    signQuery: true,
    service: "s3",
  });

  const signResult = await signer.sign();
  return signResult.url.toString()
}

export async function routeStorage(operation,body) {
  if(operation === 'getSignedUrls') {
    let path = body.path;
    if(!path) {
      path = 'auto/'+Array.from(globalThis.crypto.getRandomValues(new Uint32Array(10))).map(o =>o.toString(16)).join('')
    }

    const putSignedUrl = await signUrl(path, 'PUT');
    const getSignedUrl = await signUrl(path, 'GET');

    return {
      putSignedUrl,
      getSignedUrl
    }
  } else if(operation === 'delete') {
    const url = body.url.substring(0,body.url.indexOf('?'));
    await client.fetch(url, {
      method: 'DELETE',
    })
  } else if (operation === 'getSignerUrl') {
    const getSignedUrl = await signUrl(body.path, 'GET');
    return getSignedUrl;
  }
}