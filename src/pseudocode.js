
// 1. get app install intent
const installParams = [appId, contractAddress, initPayload, false]
const installAppIntent = [
  daoAddress,
  newAppInstanceSignature,
  installParams,
]


// 2. Get conterfatual proxy address for app
// ? what is this index ?
const nonce = await buildNonceForAddress(daoAddress, index, provider)
const proxyAddress = await calculateNewProxyAddress(daoAddress, nonce)

const permissionIntents = buildPermissionIntents(
    daoApps,
    permissions,
    roles,
    proxyAddress
  )

// 3. bundle install and permissions
// ? this is to install one app and its permissions
const appInstallIntentBasket = [installAppIntent, ...permissionIntents]

// 4. bundle all app installs
// repete for each app then
intentBasket = [...intentBasket, ...appInstallIntentBasket]

// 5. Get transaction path for install and permission intents
const { transaction } = await getTransactionPathFromIntentBasket(
    daoAddress,
    intentBasket,
    getNetworkType(),
    provider
    )
    const { to, data } = transaction

// 6. 
// ? not sure what 47 does. have a look at this on second pass
async function getInitPayload(daoApps, functions, appInitParams, settings) {
    const appInitArgs = settings
      ? parseInitParams(daoApps, appInitParams, settings)
      : []
    
    const appInit = functions.find(fn => INITIALIZE_REGEX.test(fn.sig))
    return encodeActCall(appInit.sig, appInitArgs)
  }

