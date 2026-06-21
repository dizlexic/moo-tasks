import { eventHandler } from 'h3'

export default eventHandler(async (event) => {
  const session = await getUserSessionCustom(event)
  return session
})
