import * as bwipjs from 'bwip-js'
import { writeFileAsync } from './async-io'

export const generatePDF417 = async (content: string): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    bwipjs.toBuffer({
      bcid: 'pdf417',
      text: content,
      backgroundcolor: 'ffffff',
    }, (err, png) => {
      if (err) {
        reject(err)
      } else {
        resolve(png)
      }
    })
  })
}

export const generatePDF417File = async (content: string, outputFile: string): Promise<void> => {
  const png = await generatePDF417(content)
  await writeFileAsync(outputFile, png)
}
