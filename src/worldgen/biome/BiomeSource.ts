import { BlockPos, Identifier } from '../../core/index.js'
import type { Random } from '../../math/index.js'
import { Json } from '../../util/index.js'
import { CheckerboardBiomeSource } from './CheckerboardBiomeSource.js'
import type { Climate } from './Climate.js'
import { FixedBiomeSource } from './FixedBiomeSource.js'
import { MultiNoiseBiomeSource } from './MultiNoiseBiomeSource.js'
import { TheEndBiomeSource } from './TheEndBiomeSource.js'

export interface BiomeSource {
	getBiome(x: number, y: number, z: number, climateSampler: Climate.Sampler): Identifier

}

export namespace BiomeSource {
	export function fromJson(obj: unknown): BiomeSource {
		const root = Json.readObject(obj) ?? {}
		const type = Json.readString(root.type)?.replace(/^minecraft:/, '')
		switch (type) {
			case 'fixed': return FixedBiomeSource.fromJson(obj)
			case 'checkerboard': return CheckerboardBiomeSource.fromJson(obj)
			case 'multi_noise': return MultiNoiseBiomeSource.fromJson(obj)
			case 'the_end': return TheEndBiomeSource.fromJson(obj)
			default: return new FixedBiomeSource(Identifier.create('plains'))
		}
	}

	/**
	 * Every distinct biome found in the block-space cube of radius `r` around
	 * `(x, y, z)`, sampled on the quart grid. Mirrors vanilla's
	 * `BiomeSource#getBiomesWithin`: a dense triple loop over quart positions,
	 * built entirely on the existing single-point {@link getBiome}, since
	 * that is all vanilla's own implementation does too.
	 */
	export function getBiomesWithin(biomeSource: BiomeSource, x: number, y: number, z: number, r: number, sampler: Climate.Sampler): Set<string> {
		const x0 = (x - r) >> 2
		const y0 = (y - r) >> 2
		const z0 = (z - r) >> 2
		const x1 = (x + r) >> 2
		const y1 = (y + r) >> 2
		const z1 = (z + r) >> 2
		const w = x1 - x0 + 1
		const d = y1 - y0 + 1
		const h = z1 - z0 + 1

		const biomes = new Set<string>()
		for (let row = 0; row < h; row += 1) {
			for (let column = 0; column < w; column += 1) {
				for (let depth = 0; depth < d; depth += 1) {
					const noiseX = x0 + column
					const noiseY = y0 + depth
					const noiseZ = z0 + row
					biomes.add(biomeSource.getBiome(noiseX, noiseY, noiseZ, sampler).toString())
				}
			}
		}
		return biomes
	}

	export function findBiomeHorizontal(biomeSource: BiomeSource, centerX: number, y: number, centerZ: number, range: number, predicate: (biome: Identifier) => boolean, random: Random, sampler: Climate.Sampler, step: number = 1, searchFromCenter: boolean = false) {
		if (biomeSource instanceof FixedBiomeSource){
			if (predicate(biomeSource.getBiome())){
				if (searchFromCenter){
					return {pos: BlockPos.create(centerX, y, centerZ), biome: biomeSource.getBiome()}
				} else {
					return {pos: BlockPos.create(centerX - range + random.nextInt(range * 2 + 1), y, centerZ - range + random.nextInt(range * 2 + 1)), biome: biomeSource.getBiome()}
				}
			} else {
				return undefined
			}
		}

		const centerQuardX = centerX >> 2
		const centerQuardZ = centerZ >> 2
		const quardRange = range >> 2
		const quardY = y >> 2
		var result = undefined
		var found_count = 0
		var currentRangeStart = searchFromCenter ? 0 : quardRange

		for (var currentRange = currentRangeStart; currentRange <= quardRange; currentRange += step) {
			for (var quardZOffset = -currentRange; quardZOffset <= currentRange; quardZOffset += step) {
				const isZEdge = Math.abs(quardZOffset) === currentRange

				for (var quardXOffset = -currentRange; quardXOffset <= currentRange; quardXOffset += step) {
					if (searchFromCenter){
						const isXEdge = Math.abs(quardXOffset) === currentRange
						if (!isXEdge && !isZEdge){
							continue
						}
					}

					const quardX = centerQuardX + quardXOffset
					const quardZ = centerQuardZ + quardZOffset
					const biome = biomeSource.getBiome(quardX, quardY, quardZ, sampler)
					if (predicate(biome)){
						if (result === undefined || random.nextInt(found_count + 1) <= 0.5) {
							result = {pos: BlockPos.create(quardX << 2, y, quardZ << 2), biome}
							if (searchFromCenter){
								return result
							}
						}
						found_count++
					}
				}
			}
		}
		return result
	}
}

