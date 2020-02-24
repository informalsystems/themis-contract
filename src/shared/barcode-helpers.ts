import * as bwipjs from 'bwip-js'
import { writeFileAsync } from './async-io'
import { logger } from './logging'
import { readKeybaseSig } from './keybase-helpers'
import * as path from 'path'
import * as gm from 'gm'
import { getImageSize, writeGMAsync } from './async-io'
import { Counterparty, Signatory } from './counterparties'
import * as tmp from 'tmp'
import { initialsImageName, fullSigImageName } from './template-helpers'
import { DEFAULT_SIGNATURE_FONT } from './constants'
import { findFontFile } from './font-helpers'

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

export type SignatureImageGenerationOptions = {
  counterparty: Counterparty;
  signatory: Signatory;
  font?: string;
}

export const generateCryptographicSigImages = async (keybaseSigFile: string, outputDir: string, opts: SignatureImageGenerationOptions) => {
  const tmpDir = tmp.dirSync()
  const sigFont = await findFontFile(opts.font ? opts.font : DEFAULT_SIGNATURE_FONT)

  try {
    const sig = await readKeybaseSig(keybaseSigFile)

    const tmpBarcode = path.join(tmpDir.name, 'pdf417.png')
    logger.debug('Generating barcode image for signature...')
    await generatePDF417File(sig, tmpBarcode)
    const barcodeSize = await getImageSize(tmpBarcode)
    logger.debug(`Barcode dimensions: ${barcodeSize.width} x ${barcodeSize.height}`)

    const tmpSigFull = path.join(tmpDir.name, 'sig.png')
    const destSigInitials = path.join(outputDir, `${initialsImageName(opts.counterparty.id, opts.signatory.id)}.png`)
    const destSigFull = path.join(outputDir, `${fullSigImageName(opts.counterparty.id, opts.signatory.id)}.png`)

    logger.debug(`Generating signature initials file: ${destSigInitials}`)
    await writeGMAsync(
      destSigInitials,
      gm(100, 90, '#ffffff').stroke('#000000').font(sigFont, 50).drawText(10, 50, opts.signatory.initials()),
    )

    logger.debug(`Generating full signature text: ${tmpSigFull}`)
    await writeGMAsync(
      tmpSigFull,
      gm(800, 140, '#ffffff').stroke('#000000').font(sigFont, 70).drawText(30, 80, opts.signatory.fullNames),
    )

    logger.debug(`Generating full signature with barcode: ${destSigFull}`)
    await writeGMAsync(
      destSigFull,
      gm(tmpSigFull).background('#ffffff').resize(barcodeSize.width).append(tmpBarcode),
    )
    logger.info(`Generated signature images for signature: ${keybaseSigFile}`)
  } finally {
    tmpDir.removeCallback()
  }
}
