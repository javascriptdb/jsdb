/*
import { Auth } from "@auth/core"



async function main() {
  const url = new URL('https://example.com/api/auth/signin')
  const request = new Request(url);
  const response = await Auth(request, optionsEnvVar)

  const { status = 200 } = response
  const data = await response.json()

  if (!data || !Object.keys(data).length) return null
  if (status === 200) return data
  throw new Error(data.message)
}
main().then(() => console.log('done'))

*/
