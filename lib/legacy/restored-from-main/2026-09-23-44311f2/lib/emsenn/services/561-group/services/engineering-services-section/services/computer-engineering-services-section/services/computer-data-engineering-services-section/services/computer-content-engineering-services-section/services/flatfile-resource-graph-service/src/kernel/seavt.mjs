import { seavtRow } from "@red-cup-engineering/seavt/row";
import { jsonToTerm } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/json-codec";

// FARS receives JSON coordinates at its boundary and admits each into the
// shared RMN language before writing the SEAVT row.
export function seavt(entity, attribute, value, time) {
  return seavtRow({ e: jsonToTerm(entity), a: jsonToTerm(attribute), v: jsonToTerm(value), t: time });
}
