import { Standalone } from "hap-server"

import garden from './accessories/garden'
import blinds from './accessories/blinds'

const accessories = [
  garden,
  blinds,
]

Standalone(accessories)
