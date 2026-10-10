import 'fake-indexeddb/auto'
import { db } from '../src/web/db/db'
import { createDexieRepo } from '../src/web/db/repo'
import { createMemoryRepo } from '../src/core/memoryRepo'
import { describeRepoContract } from './helpers/repoContract'

describeRepoContract('memoryRepo', () => createMemoryRepo())

describeRepoContract('dexieRepo', async () => {
  await db.delete()
  await db.open()
  return createDexieRepo()
})
