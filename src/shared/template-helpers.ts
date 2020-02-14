import * as Handlebars from 'handlebars'
import { logger } from './logging'
import { TemplateError } from './errors'

const trackVariable = (tracker: Map<string, any>, path: string[], varName: string) => {
  let trackerChild = tracker
  for (const parentVar of [...path, varName]) {
    if (!trackerChild.has(parentVar)) {
      trackerChild.set(parentVar, new Map<string, any>())
    }
    trackerChild = trackerChild.get(parentVar)
  }
}

const makeVariableTrackerProxy = (parentObj: object, parents: string[], trackedVars: Map<string, any>): object => {
  return new Proxy(parentObj, {
    get: (target, name) => {
      if (typeof name === 'symbol') {
        return ''
      }
      if (name === 'toHTML') {
        return (): string => ''
      }
      const varName = String(name)
      logger.debug(`Found potential template variable: ${varName}`)
      trackVariable(trackedVars, parents, varName)
      return makeVariableTrackerProxy(target, [...parents, varName], trackedVars)
    },
  })
}

export const extractTemplateVariables = (templateSrc: string): Map<string, any> => {
  const template = Handlebars.compile(templateSrc)
  const vars = new Map<string, any>()
  template(makeVariableTrackerProxy({}, [], vars), {allowProtoPropertiesByDefault: true})
  return vars
}

/**
 * Converts the given template variables map into a plain JavaScript object that
 * can be serialized easily to JSON or TOML. Works recursively.
 * @param {Map<string, any>} vars The variables to be converted.
 * @returns {any} The object form of the supplied variable mapping.
 */
export const templateVarsToObj = (vars: Map<string, any>): any => {
  const obj: any = {}
  vars.forEach((v, k) => {
    if (v instanceof Map) {
      obj[k] = (v.size === 0) ? '' : templateVarsToObj(v)
    } else {
      obj[k] = v
    }
  })
  return obj
}

export const initialsImageName = (counterpartyID: string, signatoryID: string): string => {
  return `${counterpartyID}__${signatoryID}__initials`
}

export const fullSigImageName = (counterpartyID: string, signatoryID: string): string => {
  return `${counterpartyID}__${signatoryID}__full`
}

export const validateTemplateSignatory = (a: any) => {
  const expectedProps = ['full_names', 'counterparty_id', 'signature_image', 'initials_image']
  for (const prop in a) {
    if (Object.prototype.hasOwnProperty.call(a, prop)) {
      const pos = expectedProps.indexOf(prop)
      if (pos > -1) {
        expectedProps.splice(pos, 1)
      }
    }
  }
  if (expectedProps.length > 0) {
    throw new TemplateError(`Signatory is missing fields: ${expectedProps.join(', ')}`)
  }
}
