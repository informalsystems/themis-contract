import * as Handlebars from 'handlebars'

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
      if (name === 'toHTML') {
        return (): string => ''
      }
      const varName = String(name)
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
