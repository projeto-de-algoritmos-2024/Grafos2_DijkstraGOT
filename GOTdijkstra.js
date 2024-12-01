const fs = require('fs');
const readline = require('readline');
const csv = require('csv-parser'); // Import csv-parser
const { Graph } = require('graphology');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const adjList = {};

function loadCSV(filePath) {
  return new Promise((resolve, reject) => {
    const data = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        data.push({
          source: row["Source"].trim(),
          target: row["Target"].trim(),
          weight: parseFloat(row["weight"]),
        });
      })
      .on("end", () => {
        console.log(`Loaded CSV data from ${filePath} with ${data.length} edges.`);
        resolve(data);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

function loadMultipleCSVs(filePaths) {
  return Promise.all(filePaths.map(loadCSV));
}

function createAdjacencyList(data) {
  data.forEach(({ source, target, weight }) => {
    if (!adjList[source]) adjList[source] = [];
    if (!adjList[target]) adjList[target] = [];
    adjList[source].push({ node: target, weight });
    adjList[target].push({ node: source, weight });
  });
  console.log("Adjacency list created.");
}

function generateGraph() {
  const graph = new Graph();
  for (const node in adjList) {
    graph.addNode(node, { label: node });
  }
  for (const node in adjList) {
    adjList[node].forEach(({ node: neighbor, weight }) => {
      if (!graph.hasEdge(node, neighbor)) {
        graph.addEdge(node, neighbor, { weight });
      }
    });
  }
  return graph;
}

class PriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(element, priority) {
    const queueElement = { element, priority };
    let added = false;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].priority > queueElement.priority) {
        this.items.splice(i, 0, queueElement);
        added = true;
        break;
      }
    }
    if (!added) {
      this.items.push(queueElement);
    }
  }

  dequeue() {
    return this.items.shift();
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

function dijkstra(graph, startNode) {
  const distances = {};
  const visited = new Set();
  const predecessors = {};
  const priorityQueue = new PriorityQueue();

  for (const node of graph.nodes()) {
    distances[node] = Infinity;
    predecessors[node] = null;
  }
  distances[startNode] = 0;
  priorityQueue.enqueue(startNode, 0);

  while (!priorityQueue.isEmpty()) {
    const { element: currentNode } = priorityQueue.dequeue();
    visited.add(currentNode);

    for (const neighbor of graph.neighbors(currentNode)) {
      if (!visited.has(neighbor)) {
        const edgeWeight = graph.getEdgeAttributes(currentNode, neighbor).weight;
        const newDist = distances[currentNode] + edgeWeight;
        if (newDist < distances[neighbor]) {
          distances[neighbor] = newDist;
          predecessors[neighbor] = currentNode;
          priorityQueue.enqueue(neighbor, newDist);
        }
      }
    }
  }

  return { distances, predecessors };
}

function findShortestPath(graph, startNode, endNode) {
  const { distances, predecessors } = dijkstra(graph, startNode);

  const path = [];
  const weights = [];
  let node = endNode;
  while (node !== null) {
    path.unshift(node);
    const prevNode = predecessors[node];
    if (prevNode !== null) {
      const edgeWeight = graph.getEdgeAttributes(prevNode, node).weight;
      weights.unshift(edgeWeight);
    }
    node = prevNode;
  }

  if (path[0] !== startNode) {
    console.error("No path found between these characters.");
    return { path: null, distance: null };
  }

  const pathString = `Shortest path from ${startNode} to ${endNode}: ${path.join(" -> ")}\n`;
  const weightsString = `Edge weights: ${weights.join(" -> ")}\n`;
  const totalWeightString = `Total weight: ${distances[endNode]}\n`;

  fs.writeFileSync('shortest_path.txt', pathString + weightsString + totalWeightString);
  console.log(pathString);
  console.log(weightsString);
  console.log(totalWeightString);

  return { path: path, distance: distances[endNode] };
}

function promptForCharacters(graph) {
  return new Promise((resolve) => {
    const characters = displayCharacters(graph);
    rl.question('\nSelect first character (number): ', (start) => {
      rl.question('Select second character (number): ', (end) => {
        const startIndex = parseInt(start) - 1;
        const endIndex = parseInt(end) - 1;
        if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= 0) {
          const startChar = characters[startIndex];
          const endChar = characters[endIndex];
          if (startChar && endChar) {
            resolve({ startChar, endChar });
          } else {
            console.log('Invalid selection. Please try again.');
            promptForCharacters(graph).then(resolve);
          }
        } else {
          console.log('Invalid input. Please enter valid numbers.');
          promptForCharacters(graph).then(resolve);
        }
      });
    });
  });
}

function displayCharacters(graph) {
  const nodes = Array.from(graph.nodes());
  nodes.forEach((node, index) => {
    console.log(`${index + 1}: ${node}`);
  });
  return nodes;
}

// Usage
const csvFiles = ['book1.csv', 'book2.csv', 'book3.csv', 'book4.csv', 'book5.csv'];
loadMultipleCSVs(csvFiles).then((allData) => {
  const combinedData = allData.flat();
  console.log(`Total edges loaded: ${combinedData.length}`);
  createAdjacencyList(combinedData);
  const graph = generateGraph();

  async function handleUserInput() {
    while (true) {
      const { startChar, endChar } = await promptForCharacters(graph);
      console.log(`\nFinding path between ${startChar} and ${endChar}...`);
      findShortestPath(graph, startChar, endChar);
      const answer = await new Promise((resolve) => {
        rl.question('\nWould you like to find another path? (y/n): ', resolve);
      });
      if (answer.toLowerCase() !== 'y') {
        rl.close();
        break;
      }
    }
  }

  handleUserInput().catch(console.error);
})
  .catch((error) => {
    console.error("Error loading CSV files:", error);
    rl.close();
  });