import { Standalone } from "hap-server"

import garden from './accessories/garden'

const accessories = [
  garden,
]

Standalone(accessories)
