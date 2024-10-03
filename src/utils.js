function applyChanges(state, diff) {

    conflictingChanges = false
    for(let userAdded of diff.addedUsers){
        // check if user already exists
        if(state.find(e => e.ipa_uid === userAdded.ipa_uid)) {conflictingChanges = true; continue}
        state.push(userAdded)
    }
    for(let userRemoved of diff.deletedUsers){
        // check if user was already removed
        if(!state.find(e => e.ipa_uid === userRemoved)) continue
        state.splice(state.findIndex(e => e.ipa_uid === userRemoved), 1)
    }
    for(let dataChange of diff.dataChange){
        let user = state.find(e => e.ipa_uid === dataChange.ipa_uid)
        if(!user) continue
        user[dataChange.field_name] = dataChange.new_value
    }
    for(let groupAdded of diff.groupsAdded) {
        let user = state.find(e => e.ipa_uid === groupAdded.ipa_uid)
        if(!user) continue
        if(user.groups.includes(groupAdded.group_cn)) {continue}
        user.groups.push(groupAdded.group_cn)
    }
    for(let groupRemoved of diff.groupsRemoved) {
        let user = state.find(e => e.ipa_uid === groupRemoved.ipa_uid)
        if(!user) continue
        if(!user.groups.includes(groupRemoved.group_cn)) {continue}
        user.groups.splice(user.groups.indexOf(groupRemoved.group_cn), 1)
    }
}

function calculateDiff(newState, oldState, field_names) {
    let diffCount = 0
    diff = {
        addedUsers: [],
        deletedUsers: [],
        dataChange: [],
        groupsAdded: [],
        groupsRemoved: []
    }


    // check if user were added 
    let currentUserIPA_IDs = []
    for (let user of newState) {
        currentUserIPA_IDs.push(user.ipa_uid)
        if (oldState.find(e => e.ipa_uid === user.ipa_uid)) {
            continue
        }
        // found added user
        diff.addedUsers.push(user)
        diffCount += 1
    }

    // check if user were deleted
    for (let user of oldState) {
        if (!currentUserIPA_IDs.includes(user.ipa_uid)) {
            diff.deletedUsers.push(user.ipa_uid)
            diffCount += 1
        }
    }

    // check if data changed
    for (let user of newState) {
        if (diff.addedUsers.find(e => e.ipa_uid === user.ipa_uid)) continue
        if (diff.deletedUsers.includes(user.ipa_uid)) continue

        let userInLastData = oldState.find(e => e.ipa_uid === user.ipa_uid)
        for (let field_name of field_names) {
            if (!(user[field_name] === userInLastData[field_name])) {
                diff.dataChange.push({
                    "ipa_uid": user.ipa_uid,
                    "field_name": field_name,
                    "new_value": user[field_name]
                })
                diffCount += 1
            }
        }
        // check if group was added
        for (let group of user.groups) {
            if (userInLastData.groups.includes(group)) continue
            diff.groupsAdded.push({
                "ipa_uid": user.ipa_uid,
                "group_cn": group
            })
            diffCount += 1
        }
        // check if group was removed
        for (let group of userInLastData.groups) {
            if (user.groups.includes(group)) continue
            diff.groupsRemoved.push({
                "ipa_uid": userInLastData.ipa_uid,
                "group_cn": group
            })
            diffCount += 1
        }
    }
    return {diff, diffCount}


}

module.exports = {calculateDiff, applyChanges}