# Scrypta Blockchain 2FA

Cercheremo di affrontare e realizzare un Proof of Concept per creare una tecnologia di 2FA (Two factor authenticator) basata su tecnologia Blockchain. Quello che andremo a realizzare sarà un bOTA ovvero un blockchain-based One Time Address, che useremo per firmare le challenge esposte dal server.

Sebbene ci siano varie alternative sul mercato riteniamo ci siano delle lacune negli attuali sistemi di 2FA:
- *TOTP*: One time passwords bassate sul tempo, per intenderci quelle di Google Authenticator o Authy, soffrono della debolezza della centralità. Il segreto viene condiviso tra i server e gli utenti ed un eventuale hacking del server può mettere a rischio centinaia o migliaia di 2FA nello stesso momento (come è successo a vari exchange o servizi).
- *Device based*: One time passwords generate attraverso devices (Yubikey o simili) sebbene siano super sicuri hanno due problemi. Il primo riguarda la "proprietà" della tecnologia, che è appunto proprietaria e non open-source. Il secondo è il costo (che le rende sicuramente proibitive su larga scala).

Cercheremo quindi di trovare un'alternativa basata su tecnologia blockchain cercando di capire eventuali benefici.

## Breve panoramica sul funzionamento dei 2FA

Che siano TOTP (HOTP) o device based i 2FA partono dal presupposto che, data un'identificazione iniziale, l'utente potrà provare in qualunque momento di essere lui perchè "possiede" qualcosa che produce una prova inconfutabile (crittograficamente parlando) e verificabile in modo indipendente dal server di riferimento.

Qui una breve spiegazione di come funzionano quelle basate sul tempo: (https://en.wikipedia.org/wiki/Time-based_One-time_Password_algorithm).

Estraiamo appunto le criticità maggiori evidenziate:

> ## Weaknesses and vulnerabilities
>
> TOTP values can be phished like passwords, though this requires attackers to proxy the credentials in real time.[2]
>
> An attacker who steals the shared secret can generate new, valid TOTP values at will. This can be a particular problem if the attacker breaches a large authentication database.[3]
>
>TOTP values are typically valid for longer than 30 seconds so that client and server time delays are accounted for.[1]

Un'altra considerazione da fare riguarda appunto la sincronia tra server e client: 

> ## Practical considerations
> For subsequent authentications to work, the clocks of the authenticatee and the authenticator need to be roughly synchronized (the authenticator will typically accept one-time passwords generated from timestamps that differ by ±1 time interval from the authenticatee's timestamp).[1]

### Considerazioni iniziali

Possiamo già iniziare a delineare una serie di vantaggi che la blockchain può portare:
- I segreti possono essere generati partendo dalla chiave pubblica (e non privata) dell'utente, annullando la responsabilità di tenere "strettamente segreta" questa chiave di partenza
- La sincronia tra tutti i server viene data dalla blockchain (ricordiamoci che uno dei primi compiti della blockchain è quello di dare un tempo *- il blocco -* a tutti i partecipanti della rete)
- La prova crittografica può essere non solo rappresentata da un numero, ma da qualsiasi "challenge" presentata dal server, in quanto la firma può avvenire di qualsiasi dato
- Grazie alla tecnologia Scrypta Card è possibile abbattere il costo del device fisico di autenticazione o addirittura annullarlo se usiamo qualcosa di puramente digitale (come un'estensione del browser o un'app)

## Implementazione lato server

Come abbiamo detto lato server dovremo implementare qualcosa basata sulla chiave pubblica dell'utente, nel nostro caso utilizzeremo la tecnologia xSID di Scrypta (Extended ScryptaID - https://github.com/scryptachain/scrypta-docs/blob/master/core/gestione-advanced.md).

Scegliamo un indirizzo di questo tipo (ovvero un wallet HD) perchè questo può generare un numero infinito di indirizzi e così potremo generare un numero infinito di OTA (One time Addresses) / OTP.

L'utente quindi dovrà mostrarci la sua `xpub` e noi dovremo archiviarla da qualche parte, per comodità usiamo le chiavi generate all'interno della guida, partendo quindi da questo `xpub`:
```
const xpub = 'xpub661MyMwAqRbcEo7pAok57j4ZyyGrb1RPodttRLWVMrJ5LKewW4Zngg3Cg3i3XaeWBaxp2EYgZA2V1mvY8QtE3hK6Un4pWyPLSFBqCPd89ZM'
```

Abbiamo quindi correttamente identificato il nostro utente e abbiamo la possibilità di generare, lato server, un infinito numero di indirizzi le cui chiavi private saranno in possesso solo e solamente da quell'utente (ovviamente non consideriamo il furto di credenziali per il momento).

Identifichiamo a questo punto una serie di condizioni che devono necessariamente essere soddisfatte da una e dall'altra parte per la generazione degli indirizzi:
- Definiamo un `service`: ovvero generiamo una stringa che identifica in modo univoco il servizio. Potrebbe essere il dominio, così come una stringa random. Per il momento devidiamo che il `service` sia appunto `Scrypta2FA`.
- Definiamo una `challenge`: ovvero una stringa randomica generata *on-the-fly* che l'utente dovrà firmare.
- Definiamo un blocco di riferimento, per sicurezza l'ultimo prodotto al momento della richiesta, così da avere un *time-frame* definito di validità ovvero il nostro codice sarà valido dal momento in cui viene effettuata la richiesta fino alla generazione di un nuovo blocco.

Componiamo quindi questi 3 elementi all'interno di una singola stringa, ad esempio:
```
Scrypta2FA/997282/B7GFX90E
```

A questo punto usiamo i due metodi facilitatori presenti all'interno di ScryptaCore per generare un path di derivazione partendo da un hash (scrypta.hash e scrypta.hashtopath):

```
const hash = scrypta.hash(challengeString)
const path = scrypta.hashtopath(hash)
const OTA = scrypta.deriveKeyfromXPub(xpub, path)
```

Il risultato sarà quindi:
```
// GENERATED PATH --> m/16050652/51207239/49901048/41324498/11349251/75416214/81325193/81241186/19119512/42002111/76

// GENERATED ADDRESS

{
  key: '03d10ec44f67484055c8fdaaab494e88f7642367fa3881ff366620b64aca1dda50',
  pub: 'LgtxTsXzoSMfi515hmA8uSjgvxJqywe6p4'
}
```

Abbiamo già raggiunto il nostro primo obiettivo, ovvero quello di generare un OTA (One Time Address) che definirà quindi l'intera "sessione" di autenticazione con 2FA.

Solo chi riuscirà a produrre una prova crittografica firmata con quella chiave privata potrà dimostrare di essere il possessore dell'xSID e quindi essere il titolare dell'account!

## Implementazione lato client

Vediamo ora come usare questo OTA lato client, ovvero ricreiamo gli stessi passaggi per generare il medesimo indirizzo, ma questa volta con la chiave privata necessaria a firmare l'operazione. Intanto definiamo l'`xprv` dell'utente, questa sarà a sua volta generata partendo dal `walletstore` adeguatamente criptato e sbloccato *on-the-fly* attraverso il PIN (o altro strumento di sblocco come fingerprint, device etc).

```
const xprv = 'xprv9s21ZrQH143K2K3M4nD4kb7qRwSNBYhYSQyHcx6soWm6TXKnxXFY8siipmQXeHPpQ6bt5HC9uUnbuAZiPbNBmzYTRj4bCa3heAwv7HZhPhd'

const OTA = await scrypta.deriveKeyFromXPrv(xprv, path)
```

Il risultato sarà quindi:
```
{
  xpub: 'xpub6Sw5fjifvnTy9teq4WxezxLbb1m3UAA74vnyZq9SftTXgc2JNQmxffgr29ZD4Ph4jCMnURQ2dsw3JMMNWfSq5pzqL8vE13eL72onyL3yqNm',
  xprv: 'xprvADwjGEBn6QufwQaMxVRedpPs2yvZ4hSFhhsNmSjq7YvYooh9psTi7sNNAq8Vc3ka26RFDxfDpv8uj8xybzH7L97SNMbTQQ2PuYLVn6vE5jU',
  key: '03d10ec44f67484055c8fdaaab494e88f7642367fa3881ff366620b64aca1dda50',
  prv: 'SkVSLCZwMg9iM77ynPpUGgT7HkQq4PBGiZ8GawFwDtevtSN8VCGE',
  pub: 'LgtxTsXzoSMfi515hmA8uSjgvxJqywe6p4'
}
```

Ora possiamo firmare il challenge aggiungendo pure il timestamp dell'utente (potremmo anche prende il timestamp dallo smart contract dedicato, ma prenderemo quello dell'utente):

```
const time = new Date().getTime()
const toSign = {
    challenge: challenge,
    time: time
}
let signed = await scrypta.signMessage(cOTA.prv, JSON.stringify(toSign))
```

Il risultato ottenuto sarà quindi: 
```
{
  message: '{"challenge":"B7GFX90E","time":1605954074698,"block":997282}',
  hash: 'bbf69cdca592ad0c95f04186808e4fc36b3be1b659c467bd02141e18cbacc357',
  signature: '1e4e777614dabb195ffd2d8a9fe877c219dc3ac2969cb691ba8c77600f606aab479e20336d2356af10bf3e03125bd99f508f4795bbae73c02d8006f8618b2a69',
  pubkey: '03d10ec44f67484055c8fdaaab494e88f7642367fa3881ff366620b64aca1dda50',
  address: 'LgtxTsXzoSMfi515hmA8uSjgvxJqywe6p4'
}
```

Abbiamo realizzato la nostra prova crittografica, ora dobbiamo inviarla nuovamente al server per la verifica!

## Match finale lato server

A questo punto manca solo la verifica lato server, intanto cerchiamo l'ultimo blocco e vediamo se per caso è cambiato, se sì la richiesta è scaduta. Dopo di che verifichiamo crittograficamente la firma e cerchiamo la corrispondenza, se tutto combacia abbiamo appena realizzato un blockchain-based 2FA!

```
const newblock = await scrypta.get('/block/last')
if(parsed.time >= (lastblock.data.time * 1000) && newblock.data.height === block){
let verify = await scrypta.verifyMessage(signed.pubkey, signed.signature, signed.message)

    if(verify !== false && verify.address === sOTA.pub){
        console.log('CHALLENGE PASSED!')
    }else{
        console.log('TRYING TO HACK THE CHALLENGE?')
    }
}
```

## Implementazioni pratiche

Ora che abbiamo teorizzato (e realizzato) una prima versione di blockchain-based 2FA basato bOTA (Block One Time Address) pubblicheremo la libreria all'interno di `npm` ed inizieremo a teorizzare le applicazioni pratiche con card (Authenticator APP) ed eventuali device fisici (ovvero l'xSID viene fisicamente sbloccato da un'azione e non da un'informazione *-password-*)

## Test e verifica

Chiunque volesse verificare ed implementare la procedura può testare l'abstract installando le dipendenze e facendo partire la demo:
```
npm install
npm run abstract
```