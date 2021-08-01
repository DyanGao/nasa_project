const axios = require('axios')
const launchesDatabase = require('./launches.mongo')
const planets = require('./planets.mongo')

const DEFAULT_FLIGHT_NUMBER = 100

//const launches = new Map()

//let latestFlightNumber = 100

// const launch = {
//   flightNumber: 100,  //flight_number
//   mission: 'Kepler Exploration X', //name
//   rocket: 'Explorer IS1', //rocket.name
//   launchDate: new Date('January 17, 2030'), //date_local
//   target: 'Kepler-442 b', //not applicable
//   customers: ['ZTM', 'NASA'], //payload.customers for each payload
//   upcoming: true, //upcoming
//   success: true //success
// }

//saveLaunch(launch)

//launches.set(launch.flightNumber, launch)
const SPACE_API_URL = 'https://api.spacexdata.com/v4/launches/query'

async function populateLaunches() {
  console.log('Downloading launch data...')
  const response = await axios.post(SPACE_API_URL, {
    query: {},
    options: {
      pagination: false,
      populate: [
        {
          path: 'rocket',
          select: {
            name: 1
          }
        },
        {
          path: 'payloads',
          select: {
            'customers': 1
          }
        }
      ]
    }
  })

  if (response.status !== 200) {
    console.log('Problem downloading launch data')
    throw new Error('Launch data download failed')
  }

  const launchDocs = response.data.docs
  for (const launchDoc of launchDocs) {
    const payloads = launchDoc['payloads']
    const customers = payloads.flatMap((payload) => {
      return payload['customers']
    })

    const launch = {
      flightNumber: launchDoc['flight_number'],
      mission: launchDoc['name'],
      rocket: launchDoc['rocket']['name'],
      launchDate: launchDoc['date_local'],
      upcoming: launchDoc['upcoming'],
      success: launchDoc['success'],
      customers,

    }
    console.log(`${launch.flightNumber} ${launch.mission}`)
    //populate launches collection...
    await saveLaunch(launch)
  }
}

async function loadLaunchesData() {
  const firstLaunch = await findLaunch({
    flightNumber: 1,
    rocket: 'Falcon 1',
    mission: 'FalconSat'
  })

  if (firstLaunch) {
    console.log('Launch data already loaded!')
    
  } else {
    await populateLaunches()
  }
}

  async function findLaunch(filter) {
    return await launchesDatabase.findOne(filter)
  }

  async function existsLaunchWithId(launchId) {
    return await findLaunch({
      flightNumber: launchId
    })
  }

  async function getLatestFlightNumber() {
    const latestLaunch = await launchesDatabase
      .findOne()
      .sort('-flightNumber')

    if (!latestLaunch) {
      return DEFAULT_FLIGHT_NUMBER
    }
    return latestLaunch.flightNumber
  }

  async function getAllLaunches(skip, limit) {
    //return Array.from(launches.values())
    return await launchesDatabase
      .find({}, { '_id': 0, '__v': 0 })
      .sort({flightNumber: 1})
      .skip(skip)
      .limit(limit)
  }

  async function saveLaunch(launch) {
    
    await launchesDatabase.findOneAndUpdate({
      flightNumber: launch.flightNumber,
    }, launch, {
      upsert: true
    })
  }

async function scheduleNewLaunch(launch) {
  const planet = await planets.findOne({
    kepler_name: launch.target
  })
  if (!planet) {
    throw new Error ('No matching planet found')
  } 
  const newFlightNumber = await getLatestFlightNumber() + 1
  const newLaunch = Object.assign(launch, {
    success: true,
    upcoming: true,
    customers: ['Zero To Mastery', 'NASA'],
    flightNumber: newFlightNumber,
  })
  await saveLaunch(newLaunch)
}

// function addNewLaunch(launch) {
//   latestFlightNumber += 1
//   launches.set(
//     latestFlightNumber,
//     Object.assign(launch, {
//       success: true,
//       upcoming: true,
//       customers: ['Zero To Mastery', 'NASA'],
//       flightNumber: latestFlightNumber,
//     })
//   )
// }

async function abortLaunchById(launchId) {
  const aborted = await launchesDatabase.updateOne({
    flightNumber: launchId
  }, {
    upcoming: false,
    success: false
  })
  return aborted.ok === 1 && aborted.nModified === 1
  // const aborted = launches.get(launchId)
  // aborted.upcoming = false
  // aborted.success = false
  // return aborted
}

module.exports = {
  loadLaunchesData,
  existsLaunchWithId,
  getAllLaunches,
  //addNewLaunch,
  scheduleNewLaunch,
  abortLaunchById
}