// Destination photography from Wikimedia Commons (free licences; credits in /CREDITS.md).
// Loaded by URL at runtime; every photo slot falls back to a blue gradient if the image can't load.
const W = (path) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}`

export const DEST_IMG = {
  delhi: W('d/df/India_Gate%2C_New_Delhi_from_West.jpg/1280px-India_Gate%2C_New_Delhi_from_West.jpg'),
  agra: W('b/b2/Taj_Mahal_Tomb_at_sunrise.JPG/1280px-Taj_Mahal_Tomb_at_sunrise.JPG'),
  jaipur: W('f/f7/Jaipur_03-2016_02_Amber_Fort.jpg/1280px-Jaipur_03-2016_02_Amber_Fort.jpg'),
  ranthambore: W('8/8f/080_Bengal_tiger_in_Ranthambore_National_Park_Photo_by_Giles_Laurent.jpg/1280px-080_Bengal_tiger_in_Ranthambore_National_Park_Photo_by_Giles_Laurent.jpg'),
  pushkar: W('c/c1/Pushkar%2C_India%2C_Pushkar_Lake_and_Ghats%2C_Twilight.jpg/1280px-Pushkar%2C_India%2C_Pushkar_Lake_and_Ghats%2C_Twilight.jpg'),
  jodhpur: W('6/65/20191210_View_from_Mehrangarh_Fort%2C_Jodhpur%2C_0950_7795.jpg/1280px-20191210_View_from_Mehrangarh_Fort%2C_Jodhpur%2C_0950_7795.jpg'),
  jaisalmer: W('e/ea/Camels_at_Sam_sand_dunes%2C_Jaisalmer_%2844753465845%29.jpg/1280px-Camels_at_Sam_sand_dunes%2C_Jaisalmer_%2844753465845%29.jpg'),
  udaipur: W('7/74/20191207_Lake_Pichola%2C_City_Palace%2C_Udaipur%2C_1516_7254.jpg/1280px-20191207_Lake_Pichola%2C_City_Palace%2C_Udaipur%2C_1516_7254.jpg'),
}

const BY_NAME = { 'new delhi': 'delhi' }
export function destImage(keyOrName) {
  if (!keyOrName) return null
  const k = String(keyOrName).toLowerCase()
  return DEST_IMG[k] || DEST_IMG[BY_NAME[k]] || DEST_IMG[k.split(/[\s,]/)[0]] || null
}
