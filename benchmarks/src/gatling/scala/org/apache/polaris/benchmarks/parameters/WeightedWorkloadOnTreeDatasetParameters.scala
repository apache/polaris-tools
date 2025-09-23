/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package org.apache.polaris.benchmarks.parameters

import com.typesafe.config.Config
import com.typesafe.scalalogging.Logger
import org.slf4j.LoggerFactory

import scala.jdk.CollectionConverters._
import scala.collection.immutable.LazyList
import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer
import scala.util.Random

/**
 * Case class to hold the parameters for the WeightedWorkloadOnTreeDataset simulation.
 *
 * @param seed The RNG seed to use
 * @param readers A seq of distrbutions to use for reading tables
 * @param writers A seq of distrbutions to use for writing to tables
 */
case class WeightedWorkloadOnTreeDatasetParameters(
    seed: Int,
    readers: Seq[Distribution],
    writers: Seq[Distribution],
    durationInMinutes: Int
) {
  require(readers.nonEmpty || writers.nonEmpty, "At least one reader or writer is required")
  require(durationInMinutes > 0, "Duration in minutes must be positive")
}

object WeightedWorkloadOnTreeDatasetParameters {
  def loadDistributionsList(config: Config, key: String): List[Distribution] =
    config.getConfigList(key).asScala.toList.map { conf =>
      Distribution(
        count = conf.getInt("count"),
        mean = conf.getDouble("mean"),
        variance = conf.getDouble("variance")
      )
    }
}

case class Distribution(count: Int, mean: Double, variance: Double) {
  private val logger = LoggerFactory.getLogger(getClass)

  def printDescription(dataset: DatasetParameters): Unit = {
    println(s"Summary for ${this}:")

    // Visualize distributions
    printVisualization(dataset.maxPossibleTables)

    // Warn if a large amount of resampling will be needed. We use a unique, but fixed,
    // seed here as it would be impossible to represent all the different reader & writer
    // seeds in one RandomNumberProvider here. The resulting samples, therefore, are
    // just an approximation of what will happen in the scenario.
    val debugRandomNumberProvider = RandomNumberProvider("debug".hashCode, -1)
    def resampleStream: LazyList[Double] =
      LazyList.continually(sample(dataset.maxPossibleTables, debugRandomNumberProvider))

    val (_, resamples) = resampleStream.zipWithIndex
      .take(100000)
      .find { case (value, _) => value >= 0 && value < dataset.maxPossibleTables }
      .getOrElse((-1, 100000))

    if (resamples > 100) {
      logger.warn(
        s"A distribution appears to require aggressive resampling: ${this} took ${resamples + 1} samples!"
      )
    }
  }

  /**
   * Return a value in [0, items) based on this distribution using truncated normal resampling.
   */
  def sample(items: Int, randomNumberProvider: RandomNumberProvider): Int = {
    val stddev = math.sqrt(variance)
    // Resample until the value is in [0, 1]
    val maxSamples = 100000
    val value = Iterator
      .continually(randomNumberProvider.next() * stddev + mean)
      .take(maxSamples)
      .find(x => x >= 0.0 && x <= 1.0)
      .getOrElse(
        throw new RuntimeException(
          s"Failed to sample a value in [0, 1] after ${maxSamples} attempts"
        )
      )

    (value * items).toInt.min(items - 1)
  }

  def printVisualization(tables: Int, samples: Int = 100000, bins: Int = 10): Unit = {
    val binCounts = Array.fill(bins)(0)
    val hits = new mutable.HashMap[Int, Int]()

    // We use a unique, but fixed, seed here as it would be impossible to represent all
    // the different reader & writer seeds in one RandomNumberProvider here. The resulting
    // samples, therefore, are just an approximation of what will happen in the scenario.
    val rng = RandomNumberProvider("visualization".hashCode, -1)

    (1 to samples).foreach { _ =>
      val value = sample(tables, rng)
      val bin = ((value.toDouble / tables) * bins).toInt.min(bins - 1)
      hits.put(value, hits.getOrElse(value, 0) + 1)
      binCounts(bin) += 1
    }

    val maxBarWidth = 50
    val total = binCounts.sum.toDouble
    println("  Range         | % of Samples | Visualization")
    println("  --------------|--------------|------------------")

    (0 until bins).foreach { i =>
      val low = i.toDouble / bins
      val high = (i + 1).toDouble / bins
      val percent = binCounts(i) / total * 100
      val bar = "█" * ((percent / 100 * maxBarWidth).round.toInt)
      println(f"  [$low%.1f - $high%.1f) | $percent%6.2f%%      | $bar")
    }
    println()

    val mode = hits.maxBy(_._2)
    val modePercentage: Int = Math.round(mode._2.toFloat / samples * 100)
    println(s"  The most frequently selected table was chosen in ~${modePercentage}% of samples")

    println()
  }
}

object Distribution {

  // Map an index back to a table path
  def tableIndexToIdentifier(index: Int, dp: DatasetParameters): (String, List[String], String) = {
    require(
      dp.numTablesMax == -1,
      "Sampling is incompatible with numTablesMax settings other than -1"
    )

    val namespaceIndex = index / dp.numTablesPerNs
    val namespaceOrdinal = dp.nAryTree.lastLevelOrdinals.toList.apply(namespaceIndex)
    val namespacePath = dp.nAryTree.pathToRoot(namespaceOrdinal)

    // TODO Refactor this line once entity names are configurable
    (s"C_0", namespacePath.map(n => s"NS_${n}"), s"T_${index}")
  }
}

case class RandomNumberProvider(seed: Int, threadId: Int) {
  private[this] val random = new Random(seed + threadId)
  def next(): Double = random.nextGaussian()
}
