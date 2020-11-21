const ScryptaCore = require('@scrypta/core')
const scrypta = new ScryptaCore
scrypta.staticnodes = true

const xpub = 'xpub661MyMwAqRbcEo7pAok57j4ZyyGrb1RPodttRLWVMrJ5LKewW4Zngg3Cg3i3XaeWBaxp2EYgZA2V1mvY8QtE3hK6Un4pWyPLSFBqCPd89ZM'

const xprv = 'xprv9s21ZrQH143K2K3M4nD4kb7qRwSNBYhYSQyHcx6soWm6TXKnxXFY8siipmQXeHPpQ6bt5HC9uUnbuAZiPbNBmzYTRj4bCa3heAwv7HZhPhd'

const service = "Scrypta2FA"
const challenge = "B7GFX90E"
const block = 0

async function init(){
    const lastblock = await scrypta.get('/block/last')
    const block = lastblock.data.height
    if(block > 0){
        // SERVER SIDE
        let challengeString = service + '/' + block + '/' + challenge
        console.log('CHALLENGE STRING IS ' + challengeString)
        const hash = await scrypta.hash(challengeString)
        const path = scrypta.hashtopath(hash)
        console.log('PATH IS ' + path)
        const sOTA = await scrypta.deriveKeyfromXPub(xpub, path)
        console.log(sOTA)

        // SIMULATING SERVER / USER TIME ELAPSE
        await scrypta.sleep(2000)

        // CLIENT SIDE
        const cOTA = await scrypta.deriveKeyFromXPrv(xprv, path)
        console.log(cOTA)
        const time = new Date().getTime()
        const toSign = {
            challenge: challenge,
            time: time,
            block: block
        }
        let signed = await scrypta.signMessage(cOTA.prv, JSON.stringify(toSign))
        console.log(signed)

        // SERVER SIDE MATCH
        let parsed = JSON.parse(signed.message)
        if(parsed.challenge === challenge && parsed.block === block && parsed.time !== undefined){
            const newblock = await scrypta.get('/block/last')
            if(parsed.time >= (lastblock.data.time * 1000) && newblock.data.height === block){
                let verify = await scrypta.verifyMessage(signed.pubkey, signed.signature, signed.message)
                console.log(verify)
                if(verify !== false && verify.address === sOTA.pub){
                    console.log('CHALLENGE PASSED!')
                }else{
                    console.log('TRYING TO HACK THE CHALLENGE?')
                }
            }else{
                console.log('REQUEST CHALLENGE EXPIRED!')
            }
        }
    }else{
        console.log('ERROR WHILE FETCHING LAST BLOCK')
    }
}

init()