const { getAllPlanets } = require('../../models/planets.model')


async function httpGetAllPlanets(req, res, next) {
  return res.status(200).json(await getAllPlanets())
}

module.exports = {
  httpGetAllPlanets
}