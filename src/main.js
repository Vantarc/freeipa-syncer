const DirectusProvider = require("./sync_providers/DirectusProvider")
const FreeIPAProvider = require("./sync_providers/FreeIPAProvider")
const utils = require("./utils")
const express = require('express');

let currentlySyncing = false

const app = express();

app.post('/sync', (req, res) => {
    console.log("Sync triggered!")
    sync();
    res.status(200).json({status:"ok"})
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
    let {directus_diff,_} = directus.calculateDiff()
    
    let masterState = freeipa.getCurrentState()
    // apply changes to masterState
    utils.applyChanges(masterState, directus_diff)

    let {apply_freeipaDiff, freeipa_diff_count} = freeipa.calculateDiffForNewData(masterState)
    await freeipa.applyDiff(apply_freeipaDiff).catch(e => console.log(e))

    let {apply_directusDiff, directus_diff_count} = directus.calculateDiffForNewData(masterState)
    await directus.applyDiff(apply_directusDiff).catch(e => console.log(e))

    await directus.updateCurrentState().catch(e => console.log(e))
    directus.safeCurrentState()

    await freeipa.updateCurrentState().catch(e => console.log(e))
    freeipa.safeCurrentState()
    currentlySyncing = false
    if(freeipa_diff_count + directus_diff_count > 0){
        console.log("Finished syncing, but started new iteration because changes were made!")
        sync()
    }
    console.log("Finished syncing")
}

app.listen(3000, () => {
    setInterval(sync, 1000 * 60 * 10)
    console.log('server listening on port 3000')

})
