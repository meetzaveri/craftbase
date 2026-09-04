// geoText renders identically to newText — it's the same Two.js text group; the
// only difference lives in the component (geoText.tsx counter-scales the group
// on zoom). Re-export NewTextFactory so the componentType→factory lookups
// (group reconstruction in groupobject.tsx, etc.) resolve `geoText` to the same
// builder without duplicating the rendering code.
import NewTextFactory from './newText'

export default NewTextFactory
