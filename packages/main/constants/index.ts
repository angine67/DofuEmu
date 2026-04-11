import { app } from 'electron'
import path from 'path'

export const APP_PATH = app.getAppPath()

let _gamePath: string | null = null
export function getGamePath(): string {
  if (!_gamePath) _gamePath = path.join(app.getPath('userData'), 'game') + '/'
  return _gamePath
}

let _charImagesPath: string | null = null
export function getCharacterImagesPath(): string {
  if (!_charImagesPath) _charImagesPath = path.join(app.getPath('userData'), 'character-images') + '/'
  return _charImagesPath
}

export const get = {
  GAME_PATH: () => getGamePath(),
  CHARACTER_IMAGES_PATH: () => getCharacterImagesPath(),
  LOCAL_ASSET_MAP_PATH: () => getGamePath() + 'assetMap.json',
  LOCAL_DOFUS_MANIFEST_PATH: () => getGamePath() + 'manifest.json',
  LOCAL_CUSTOM_MANIFEST_PATH: () => getGamePath() + 'customManifest.json',
  LOCAL_REGEX_PATH: () => getGamePath() + 'regex.json',
  LOCAL_VERSIONS_PATH: () => getGamePath() + 'versions.json',
}
