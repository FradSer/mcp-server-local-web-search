import Queue from "p-queue"

const writeQueue = new Queue({ concurrency: 1 })

export const writeStdout = async (output: string) => {
  await writeQueue.add(
    () =>
      new Promise<void>((resolve, reject) => {
        process.stdout.write(output, (err) => {
          if (err) {
            return reject(err)
          }
          resolve()
        })
      }),
  )
}
