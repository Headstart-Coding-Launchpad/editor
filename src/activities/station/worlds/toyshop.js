// The toy shop world (Mouse and Keyboard Lesson 4, scroll): eight toys in catalogue order (the
// rainbow castle, the best one, last) and ten window spots. Layout is Lesson Gen's
// public/station/toyshop/parts.json.
import pack from '../../../../public/station/toyshop/parts.json'
import { worldFromPack } from './pack.js'

export default worldFromPack('toyshop', 'Toy shop', pack, { lesson: 4 })
