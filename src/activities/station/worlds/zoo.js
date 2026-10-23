// The zoo world (Mouse and Keyboard Lesson 3, drag): four enclosures, nine animals and twelve spots,
// each spot taking only its enclosure's kind. Layout is Lesson Gen's public/station/zoo/parts.json.
import pack from '../../../../public/station/zoo/parts.json'
import { worldFromPack } from './pack.js'

export default worldFromPack('zoo', 'Zoo', pack, {
  lesson: 3,
  enclosureLabels: { ice: 'Ice and pool', grass: 'Grassland', jungle: 'Jungle', water: 'Pond' },
})
