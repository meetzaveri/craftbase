// geoText renders identically to newText — it's the same Two.js text group, and
// since the counter-scale was dropped the component behaves the same too. What
// still separates them is `objectClass: 'geo'`: geoText belongs to the map base
// and hides on the board base. Re-export NewTextFactory so the componentType→factory
// lookups (group reconstruction in groupobject.tsx, etc.) resolve `geoText` to
// the same builder without duplicating the rendering code.
import NewTextFactory from './newText'

export default NewTextFactory
