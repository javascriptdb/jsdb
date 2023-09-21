export function getSignInPopup(baseUrl: string, provider: string) {
    return `
  <html>
    <body>
       <script>
          async function main() {
              const csrfTokenResp =  await fetch("${baseUrl}" + "/auth/csrf", {
                credentials: "include",
                method: "get",
                mode: 'cors',
              })
              const { csrfToken } = await csrfTokenResp.json()
              const callbackUrl = "${baseUrl}";
              console.log(callbackUrl)
              const resp = await fetch("${baseUrl}" + "/auth/signin/" + "${provider}", {
                method: "post",
                credentials: "include",
                mode: 'cors',
                redirect: 'follow',
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  csrfToken,
                  callbackUrl,
                }),
              })
              const link = await resp.text();
              window.location.assign(link)
           }
           setTimeout(() => {
                        main();
           }, 1)
       </script>
    </body>
  </html>
  `
}
