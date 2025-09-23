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
package org.apache.polaris.benchmarks

/**
 * Builds a complete N-ary tree structure for organizing namespaces in synthetic datasets.
 *
 * This builder is used to create a hierarchical namespace structure where each non-leaf namespace
 * has exactly `nsWidth` child namespaces. The tree structure is used to organize tables and views
 * in a deterministic way. Tables and views are placed in the leaf namespaces of the tree.
 *
 * @param nsWidth The number of children each non-leaf namespace will have (N)
 * @param nsDepth The total depth of the tree, including the root namespace
 */
case class NAryTreeBuilder(nsWidth: Int, nsDepth: Int) {

  /**
   * Computes the path from the root node to the given ordinal.
   *
   * @param ordinal the ordinal of the node
   * @param acc the accumulator for the path
   * @return the path from the root node (included) to the given ordinal (included)
   */
  @scala.annotation.tailrec
  final def pathToRoot(ordinal: Int, acc: List[Int] = Nil): List[Int] =
    if (ordinal == 0) {
      ordinal :: acc
    } else {
      val parent = (ordinal - 1) / nsWidth
      pathToRoot(parent, ordinal :: acc)
    }

  /**
   * Computes the ordinals of all child nodes for a given node.
   *
   * @param ordinal the ordinal of the parent node
   * @return a list of ordinals representing the child nodes
   */
  def childrenOf(ordinal: Int): List[Int] =
    if (depthOf(ordinal) >= nsDepth - 1) {
      // Node is a leaf, has no children
      List.empty
    } else {
      // For a node with ordinal p, its children have ordinals: p*nsWidth + 1, p*nsWidth + 2, ..., p*nsWidth + nsWidth
      val firstChild = ordinal * nsWidth + 1
      (firstChild until firstChild + nsWidth).toList
    }

  /**
   * Calculates the depth of a node in the n-ary tree based on its ordinal.
   *
   * @param ordinal The ordinal of the node.
   * @return The depth of the node in the tree.
   */
  def depthOf(ordinal: Int): Int = {
    if (ordinal == 0) return 0
    if (nsWidth == 1) return ordinal

    // Using the formula: floor(log_n((x * (n-1)) + 1))
    val numerator = (ordinal * (nsWidth - 1)) + 1
    (math.log(numerator) / math.log(nsWidth)).floor.toInt
  }

  /**
   * Calculate the total number of nodes in a complete n-ary tree.
   *
   * @return The total number of nodes in the tree.
   */
  val numberOfNodes: Int =
    // The sum of nodes from level 0 to level d-1 is (n^(d+1) - 1) / (n - 1) if n > 1
    // Else, the sum of nodes from level 0 to level d-1 is d
    if (nsWidth == 1) {
      nsDepth
    } else {
      ((math.pow(nsWidth, nsDepth) - 1) / (nsWidth - 1)).toInt
    }

  /**
   * Returns a range of ordinals for the nodes on the last level of a complete n-ary tree.
   *
   * @return The range of ordinals for the nodes on the last level of the tree.
   */
  val lastLevelOrdinals: Range = {
    val lastLevel = nsDepth - 1
    if (nsWidth == 1) {
      // For a unary tree, the only node at depth d is simply the node with ordinal d.
      Range.inclusive(lastLevel, lastLevel)
    } else {
      // The sum of nodes from level 0 to level d-1 is (n^d - 1) / (n - 1)
      val start = ((math.pow(nsWidth, lastLevel) - 1) / (nsWidth - 1)).toInt
      // The sum of nodes from level 0 to level d is (n^(d+1) - 1) / (n - 1)
      // Therefore, the last ordinal at depth d is:
      val end = (((math.pow(nsWidth, lastLevel + 1) - 1) / (nsWidth - 1)).toInt) - 1
      Range.inclusive(start, end)
    }
  }

  val numberOfLastLevelElements: Int = {
    val lastLevel = nsDepth - 1
    math.pow(nsWidth, lastLevel).toInt
  }

  /**
   * Computes the ordinals of all sibling nodes for a given node.
   *
   * @param ordinal the ordinal of the node
   * @return a list of ordinals representing the sibling nodes (excluding the node itself)
   */
  def siblingsOf(ordinal: Int): List[Int] =
    if (ordinal == 0) {
      // Root node has no siblings
      List.empty
    } else {
      // Get parent ordinal
      val parent = (ordinal - 1) / nsWidth
      // Get all children of parent (siblings including self) and exclude self
      childrenOf(parent).filter(_ != ordinal)
    }
}
