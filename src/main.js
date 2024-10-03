const DirectusProvider = require("./sync_providers/DirectusProvider")
const FreeIPAProvider = require("./sync_providers/FreeIPAProvider")
const utils = require("./utils")
const express = require('express');

let currentlySyncing = false

const app = express();

app.post('/sync', (req, res) => {
    console.log("Sync triggered!")
    sync();
})


async function sync() {
    if(currentlySyncing){
        return
    }
    currentlySyncing = true
    var directus = new DirectusProvider()
    var freeipa = new FreeIPAProvider()
    await directus.updateCurrentState().catch(e => console.log(e))

    await freeipa.updateCurrentState().catch(e => console.log(e))
    let directus_diff = directus.calculateDiff()
    
    let masterState = freeipa.getCurrentState()
    console.log(directus_diff)
    // apply changes to masterState
    utils.applyChanges(masterState, directus_diff)
    await freeipa.applyDiff(freeipa.calculateDiffForNewData(masterState)).catch(e => console.log(e))

    await directus.applyDiff(directus.calculateDiffForNewData(masterState)).catch(e => console.log(e))

    await directus.updateCurrentState().catch(e => console.log(e))
    directus.safeCurrentState()

    await freeipa.updateCurrentState().catch(e => console.log(e))
    freeipa.safeCurrentState()
    currentlySyncing = false


}

app.listen(3000, () => {
    setInterval(sync, 1000 * 60 * 10)
    console.log('server listening on port 3000')

})
