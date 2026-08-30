## Notes

- By default base is private, (isPublic:false). If user wants to make it public, they can do by sharing it. Craftbase will prompt before doing this.

### Access control on the components (on public bases)

- The components(rectangle,circle, etc...) on the base, which are created by the user, when they share the base, should the other user , who didn't created the component, can delete it ? Should we goven this by access control, meaning the component should only be deleted by the user who created it ? Or should it be allowed to be deleted by anyone , in case the base is public ? . We came to a point , for now, we 'll allow anyone to modify/delete the component on a base, if that base is set to 'isPublic: true'.

What if user who created components, wants it to be unmodified by others ?

- We can provide a feature like lock on components. Meaning this , if triggered by user , can create lock on modifying component by any users, including user who created it.
