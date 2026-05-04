/* eslint-disable */
const PATTERNS = [
  // ─── 1. Sliding Window ──────────────────────────────────────────────────────
  {
    id: 'sliding-window',
    name: 'Sliding Window',
    icon: '⊡',
    color: '#6366f1',
    bg: 'rgba(99,102,241,.15)',
    description: 'Use a window that expands/contracts over the data to reduce nested loops.',
    problems: [
      {
        id: 'max-sum-k',
        title: 'Max Sum Subarray of Size K',
        difficulty: 'Easy',
        leetcode: 643,
        animId: 'sw-max-sum',
        tags: ['Array'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        description: `Find the maximum sum of any contiguous subarray of size <code>k</code>.

<div class="example-block">Input:  arr = [2, 1, 5, 1, 3, 2], k = 3
Output: 9  →  subarray [5, 1, 3]</div>

<strong>Why brute force is slow:</strong> For every starting index recompute the sum of k elements — O(n·k). The window avoids recomputation.`,
        approach: `<strong>1.</strong> Compute the sum of the first k elements.<br>
<strong>2.</strong> Slide the window right: <em>add</em> the new right element and <em>subtract</em> the old left element.<br>
<strong>3.</strong> Track the running maximum.

Each element is touched exactly once → <strong>O(n)</strong>.`,
        solutions: {
          javascript: `function maxSumSubarray(arr, k) {
  let windowSum = 0, maxSum = 0;
  let windowStart = 0;

  for (let windowEnd = 0; windowEnd < arr.length; windowEnd++) {
    windowSum += arr[windowEnd]; // expand window

    if (windowEnd >= k - 1) {
      maxSum = Math.max(maxSum, windowSum);
      windowSum -= arr[windowStart]; // shrink window
      windowStart++;
    }
  }

  return maxSum;
}`,
          python: `def max_sum_subarray(arr: list[int], k: int) -> int:
    window_sum = 0
    max_sum = 0
    window_start = 0

    for window_end in range(len(arr)):
        window_sum += arr[window_end]  # expand window

        if window_end >= k - 1:
            max_sum = max(max_sum, window_sum)
            window_sum -= arr[window_start]  # shrink window
            window_start += 1

    return max_sum`
        }
      },
      {
        id: 'longest-no-repeat',
        title: 'Longest Substring Without Repeating',
        difficulty: 'Medium',
        leetcode: 3,
        animId: 'sw-no-repeat',
        tags: ['String', 'Hash Map'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(k)',
        description: `Given a string, find the length of the <strong>longest substring</strong> without repeating characters.

<div class="example-block">Input:  s = "abcabcbb"
Output: 3  →  substring "abc"</div>`,
        approach: `Use a <strong>dynamic-size</strong> sliding window with a character frequency map.<br>
<strong>1.</strong> Expand right: add character to map.<br>
<strong>2.</strong> If char appears > 1 time, shrink left until it doesn't.<br>
<strong>3.</strong> Track max window size seen.`,
        solutions: {
          javascript: `function lengthOfLongestSubstring(s) {
  const freq = {};
  let windowStart = 0, maxLen = 0;

  for (let windowEnd = 0; windowEnd < s.length; windowEnd++) {
    const ch = s[windowEnd];
    freq[ch] = (freq[ch] || 0) + 1;

    while (freq[ch] > 1) {           // shrink until no duplicate
      freq[s[windowStart]]--;
      windowStart++;
    }

    maxLen = Math.max(maxLen, windowEnd - windowStart + 1);
  }

  return maxLen;
}`,
          python: `def length_of_longest_substring(s: str) -> int:
    freq = {}
    window_start = 0
    max_len = 0

    for window_end, ch in enumerate(s):
        freq[ch] = freq.get(ch, 0) + 1

        while freq[ch] > 1:      # shrink until no duplicate
            freq[s[window_start]] -= 1
            window_start += 1

        max_len = max(max_len, window_end - window_start + 1)

    return max_len`
        }
      },
      {
        id: 'min-window-substr',
        title: 'Minimum Window Substring',
        difficulty: 'Hard',
        leetcode: 76,
        animId: null,
        tags: ['String', 'Hash Map'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(k)',
        description: `Given strings <code>s</code> and <code>t</code>, find the minimum window in <code>s</code> that contains all characters of <code>t</code>.

<div class="example-block">Input:  s = "ADOBECODEBANC", t = "ABC"
Output: "BANC"</div>`,
        approach: `<strong>1.</strong> Count all chars needed from <code>t</code>.<br>
<strong>2.</strong> Expand right until all characters are satisfied.<br>
<strong>3.</strong> Shrink left as much as possible while keeping all chars.<br>
<strong>4.</strong> Record the minimum window found.`,
        solutions: {
          javascript: `function minWindow(s, t) {
  const need = {}, have = {};
  for (const ch of t) need[ch] = (need[ch] || 0) + 1;
  let formed = 0, required = Object.keys(need).length;
  let windowStart = 0, minLen = Infinity, minStart = 0;

  for (let windowEnd = 0; windowEnd < s.length; windowEnd++) {
    const ch = s[windowEnd];
    have[ch] = (have[ch] || 0) + 1;
    if (need[ch] && have[ch] === need[ch]) formed++;

    while (formed === required) {
      if (windowEnd - windowStart + 1 < minLen) {
        minLen = windowEnd - windowStart + 1;
        minStart = windowStart;
      }
      const left = s[windowStart++];
      have[left]--;
      if (need[left] && have[left] < need[left]) formed--;
    }
  }

  return minLen === Infinity ? '' : s.slice(minStart, minStart + minLen);
}`,
          python: `from collections import Counter

def min_window(s: str, t: str) -> str:
    need = Counter(t)
    have, formed = {}, 0
    required = len(need)
    window_start = 0
    min_len, min_start = float('inf'), 0

    for window_end, ch in enumerate(s):
        have[ch] = have.get(ch, 0) + 1
        if ch in need and have[ch] == need[ch]:
            formed += 1

        while formed == required:
            if window_end - window_start + 1 < min_len:
                min_len = window_end - window_start + 1
                min_start = window_start
            left = s[window_start]
            have[left] -= 1
            if left in need and have[left] < need[left]:
                formed -= 1
            window_start += 1

    return '' if min_len == float('inf') else s[min_start:min_start + min_len]`
        }
      }
    ]
  },

  // ─── 2. Two Pointers ────────────────────────────────────────────────────────
  {
    id: 'two-pointers',
    name: 'Two Pointers',
    icon: '↔',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,.15)',
    description: 'Two indices move inward/forward to scan sorted arrays without extra space.',
    problems: [
      {
        id: 'two-sum-sorted',
        title: 'Two Sum II — Sorted Array',
        difficulty: 'Easy',
        leetcode: 167,
        animId: 'tp-two-sum',
        tags: ['Array', 'Two Pointers'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        description: `Given a <strong>sorted</strong> array, find two numbers that sum to a <code>target</code>. Return their 1-indexed positions.

<div class="example-block">Input:  arr = [2, 7, 11, 15], target = 9
Output: [1, 2]  →  arr[0] + arr[1] = 9</div>`,
        approach: `Place one pointer at each end of the sorted array.<br>
• If <code>sum < target</code> → move <strong>left pointer right</strong> (increase sum).<br>
• If <code>sum > target</code> → move <strong>right pointer left</strong> (decrease sum).<br>
• If <code>sum = target</code> → found!

Works because the array is sorted — every move is optimal.`,
        solutions: {
          javascript: `function twoSum(numbers, target) {
  let left = 0, right = numbers.length - 1;

  while (left < right) {
    const sum = numbers[left] + numbers[right];

    if (sum === target)  return [left + 1, right + 1];
    if (sum < target)    left++;
    else                 right--;
  }

  return [-1, -1];
}`,
          python: `def two_sum(numbers: list[int], target: int) -> list[int]:
    left, right = 0, len(numbers) - 1

    while left < right:
        s = numbers[left] + numbers[right]

        if s == target:   return [left + 1, right + 1]
        elif s < target:  left += 1
        else:             right -= 1

    return [-1, -1]`
        }
      },
      {
        id: 'container-water',
        title: 'Container With Most Water',
        difficulty: 'Medium',
        leetcode: 11,
        animId: 'tp-container',
        tags: ['Array', 'Greedy'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        description: `Given <code>n</code> heights, find two lines that together with the x-axis form a container that holds the most water.

<div class="example-block">Input:  height = [1, 8, 6, 2, 5, 4, 8, 3, 7]
Output: 49  →  lines at index 1 and 8</div>`,
        approach: `Start with the widest container (left=0, right=n-1).<br>
Move the pointer at the <strong>shorter height</strong> inward — only by increasing the shorter height can we improve. The wider configuration already gave the best for the current shorter wall.`,
        solutions: {
          javascript: `function maxArea(height) {
  let left = 0, right = height.length - 1;
  let maxWater = 0;

  while (left < right) {
    const water = Math.min(height[left], height[right]) * (right - left);
    maxWater = Math.max(maxWater, water);

    if (height[left] < height[right]) left++;
    else                              right--;
  }

  return maxWater;
}`,
          python: `def max_area(height: list[int]) -> int:
    left, right = 0, len(height) - 1
    max_water = 0

    while left < right:
        water = min(height[left], height[right]) * (right - left)
        max_water = max(max_water, water)

        if height[left] < height[right]:
            left += 1
        else:
            right -= 1

    return max_water`
        }
      },
      {
        id: 'three-sum',
        title: '3Sum',
        difficulty: 'Medium',
        leetcode: 15,
        animId: null,
        tags: ['Array', 'Sorting'],
        timeComplexity: 'O(n²)',
        spaceComplexity: 'O(n)',
        description: `Find all <strong>unique triplets</strong> in the array that sum to zero.

<div class="example-block">Input:  nums = [-1, 0, 1, 2, -1, -4]
Output: [[-1, -1, 2], [-1, 0, 1]]</div>`,
        approach: `<strong>1.</strong> Sort the array.<br>
<strong>2.</strong> Fix one element at index <code>i</code>.<br>
<strong>3.</strong> Run Two Pointers on the remaining subarray to find pairs summing to <code>-nums[i]</code>.<br>
<strong>4.</strong> Skip duplicates carefully.`,
        solutions: {
          javascript: `function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue; // skip duplicate

    let left = i + 1, right = nums.length - 1;

    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];
      if (sum === 0) {
        result.push([nums[i], nums[left], nums[right]]);
        while (left < right && nums[left] === nums[left + 1]) left++;
        while (left < right && nums[right] === nums[right - 1]) right--;
        left++; right--;
      } else if (sum < 0) {
        left++;
      } else {
        right--;
      }
    }
  }

  return result;
}`,
          python: `def three_sum(nums: list[int]) -> list[list[int]]:
    nums.sort()
    result = []

    for i in range(len(nums) - 2):
        if i > 0 and nums[i] == nums[i - 1]:
            continue   # skip duplicate

        left, right = i + 1, len(nums) - 1

        while left < right:
            s = nums[i] + nums[left] + nums[right]
            if s == 0:
                result.append([nums[i], nums[left], nums[right]])
                while left < right and nums[left] == nums[left+1]: left += 1
                while left < right and nums[right] == nums[right-1]: right -= 1
                left += 1; right -= 1
            elif s < 0:
                left += 1
            else:
                right -= 1

    return result`
        }
      }
    ]
  },

  // ─── 3. Fast & Slow Pointers ────────────────────────────────────────────────
  {
    id: 'fast-slow',
    name: 'Fast & Slow Pointers',
    icon: '⊛',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,.15)',
    description: 'Two pointers at different speeds detect cycles or find midpoints in linked lists.',
    problems: [
      {
        id: 'linked-list-cycle',
        title: 'Linked List Cycle',
        difficulty: 'Easy',
        leetcode: 141,
        animId: 'fs-cycle',
        tags: ['Linked List'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        description: `Given a linked list, determine if it has a cycle.

<div class="example-block">Input:  3 → 2 → 0 → -4 → (back to 2)
Output: true</div>

<strong>Key insight:</strong> If two runners (slow +1, fast +2) are on a circular track, the fast one will eventually lap the slow one.`,
        approach: `Move <code>slow</code> one step and <code>fast</code> two steps per iteration.<br>
• If they ever point to the same node → <strong>cycle exists</strong>.<br>
• If <code>fast</code> reaches <code>null</code> → <strong>no cycle</strong>.

Floyd's tortoise-and-hare algorithm. No extra data structure needed.`,
        solutions: {
          javascript: `function hasCycle(head) {
  let slow = head, fast = head;

  while (fast !== null && fast.next !== null) {
    slow = slow.next;
    fast = fast.next.next;

    if (slow === fast) return true; // pointers met → cycle!
  }

  return false;
}`,
          python: `def has_cycle(head) -> bool:
    slow = fast = head

    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next

        if slow is fast:    # pointers met → cycle!
            return True

    return False`
        }
      },
      {
        id: 'middle-linked-list',
        title: 'Middle of Linked List',
        difficulty: 'Easy',
        leetcode: 876,
        animId: 'fs-middle',
        tags: ['Linked List'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        description: `Return the middle node of a singly linked list. If two middles exist, return the second.

<div class="example-block">Input:  1 → 2 → 3 → 4 → 5
Output: Node 3

Input:  1 → 2 → 3 → 4
Output: Node 3  (second middle)</div>`,
        approach: `When <code>fast</code> reaches the end, <code>slow</code> is at the middle.<br>
Fast moves 2× as fast as slow — so when fast travels the whole list, slow has traveled half.`,
        solutions: {
          javascript: `function middleNode(head) {
  let slow = head, fast = head;

  while (fast !== null && fast.next !== null) {
    slow = slow.next;
    fast = fast.next.next;
  }

  return slow; // slow is at the middle
}`,
          python: `def middle_node(head):
    slow = fast = head

    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next

    return slow  # slow is at the middle`
        }
      }
    ]
  },

  // ─── 4. Binary Search ───────────────────────────────────────────────────────
  {
    id: 'binary-search',
    name: 'Binary Search',
    icon: '⌖',
    color: '#22c55e',
    bg: 'rgba(34,197,94,.15)',
    description: 'Eliminate half the search space each iteration on sorted/monotone data.',
    problems: [
      {
        id: 'classic-bs',
        title: 'Binary Search',
        difficulty: 'Easy',
        leetcode: 704,
        animId: 'bs-classic',
        tags: ['Array', 'Binary Search'],
        timeComplexity: 'O(log n)',
        spaceComplexity: 'O(1)',
        description: `Given a <strong>sorted</strong> array and a target, return the index if found, else <code>-1</code>.

<div class="example-block">Input:  nums = [-1, 0, 3, 5, 9, 12], target = 9
Output: 4</div>`,
        approach: `<strong>1.</strong> Set <code>left = 0</code>, <code>right = n-1</code>.<br>
<strong>2.</strong> Compute <code>mid = left + (right - left) / 2</code>.<br>
<strong>3.</strong> If <code>nums[mid] = target</code> → found. If less → search right half. If greater → search left half.<br>
<strong>4.</strong> Repeat until <code>left > right</code>.`,
        solutions: {
          javascript: `function search(nums, target) {
  let left = 0, right = nums.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);

    if (nums[mid] === target) return mid;
    if (nums[mid] < target)  left = mid + 1;
    else                     right = mid - 1;
  }

  return -1;
}`,
          python: `def search(nums: list[int], target: int) -> int:
    left, right = 0, len(nums) - 1

    while left <= right:
        mid = left + (right - left) // 2

        if nums[mid] == target:  return mid
        elif nums[mid] < target: left = mid + 1
        else:                    right = mid - 1

    return -1`
        }
      },
      {
        id: 'rotated-bs',
        title: 'Search in Rotated Sorted Array',
        difficulty: 'Medium',
        leetcode: 33,
        animId: null,
        tags: ['Array'],
        timeComplexity: 'O(log n)',
        spaceComplexity: 'O(1)',
        description: `A sorted array was rotated at an unknown pivot. Search for a target.

<div class="example-block">Input:  nums = [4, 5, 6, 7, 0, 1, 2], target = 0
Output: 4</div>`,
        approach: `At every mid, one half is <strong>always sorted</strong>.<br>
Check if target lies in the sorted half → search there. Otherwise search the other half.`,
        solutions: {
          javascript: `function search(nums, target) {
  let left = 0, right = nums.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    if (nums[mid] === target) return mid;

    // Left half is sorted
    if (nums[left] <= nums[mid]) {
      if (nums[left] <= target && target < nums[mid]) right = mid - 1;
      else                                            left = mid + 1;
    } else { // Right half is sorted
      if (nums[mid] < target && target <= nums[right]) left = mid + 1;
      else                                             right = mid - 1;
    }
  }

  return -1;
}`,
          python: `def search(nums: list[int], target: int) -> int:
    left, right = 0, len(nums) - 1

    while left <= right:
        mid = left + (right - left) // 2
        if nums[mid] == target: return mid

        if nums[left] <= nums[mid]:   # left half sorted
            if nums[left] <= target < nums[mid]:
                right = mid - 1
            else:
                left = mid + 1
        else:                          # right half sorted
            if nums[mid] < target <= nums[right]:
                left = mid + 1
            else:
                right = mid - 1

    return -1`
        }
      },
      {
        id: 'find-peak',
        title: 'Find Peak Element',
        difficulty: 'Medium',
        leetcode: 162,
        animId: null,
        tags: ['Array'],
        timeComplexity: 'O(log n)',
        spaceComplexity: 'O(1)',
        description: `A peak element is greater than its neighbors. Find any peak index.

<div class="example-block">Input:  nums = [1, 2, 3, 1]
Output: 2  →  nums[2] = 3 is a peak</div>`,
        approach: `If <code>nums[mid] < nums[mid+1]</code>, a peak must exist in the right half (values are rising). Otherwise it's in the left half or at mid.`,
        solutions: {
          javascript: `function findPeakElement(nums) {
  let left = 0, right = nums.length - 1;

  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);

    if (nums[mid] < nums[mid + 1]) left = mid + 1; // climbing up
    else                           right = mid;     // at or past peak
  }

  return left;
}`,
          python: `def find_peak_element(nums: list[int]) -> int:
    left, right = 0, len(nums) - 1

    while left < right:
        mid = left + (right - left) // 2

        if nums[mid] < nums[mid + 1]:
            left = mid + 1   # climbing up
        else:
            right = mid      # at or past peak

    return left`
        }
      }
    ]
  },

  // ─── 5. Merge Intervals ─────────────────────────────────────────────────────
  {
    id: 'merge-intervals',
    name: 'Merge Intervals',
    icon: '⋈',
    color: '#ec4899',
    bg: 'rgba(236,72,153,.15)',
    description: 'Sort intervals by start time then greedily merge overlapping ones.',
    problems: [
      {
        id: 'merge-intervals-p',
        title: 'Merge Intervals',
        difficulty: 'Medium',
        leetcode: 56,
        animId: 'mi-merge',
        tags: ['Array', 'Sorting'],
        timeComplexity: 'O(n log n)',
        spaceComplexity: 'O(n)',
        description: `Given an array of intervals, merge all overlapping intervals.

<div class="example-block">Input:  [[1,3],[2,6],[8,10],[15,18]]
Output: [[1,6],[8,10],[15,18]]</div>`,
        approach: `<strong>1.</strong> Sort by start time.<br>
<strong>2.</strong> Keep a <em>current</em> interval. For each next interval:<br>
&nbsp;&nbsp;• If it overlaps (<code>next.start ≤ current.end</code>) → extend current end.<br>
&nbsp;&nbsp;• Otherwise → push current, start new current.`,
        solutions: {
          javascript: `function merge(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const [start, end] = intervals[i];

    if (start <= last[1]) {
      last[1] = Math.max(last[1], end); // merge
    } else {
      merged.push([start, end]);         // no overlap
    }
  }

  return merged;
}`,
          python: `def merge(intervals: list[list[int]]) -> list[list[int]]:
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]

    for start, end in intervals[1:]:
        last = merged[-1]

        if start <= last[1]:
            last[1] = max(last[1], end)   # merge
        else:
            merged.append([start, end])    # no overlap

    return merged`
        }
      },
      {
        id: 'insert-interval',
        title: 'Insert Interval',
        difficulty: 'Medium',
        leetcode: 57,
        animId: null,
        tags: ['Array'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        description: `Given sorted non-overlapping intervals and a new interval, insert and merge as needed.

<div class="example-block">Input:  intervals = [[1,3],[6,9]], newInterval = [2,5]
Output: [[1,5],[6,9]]</div>`,
        approach: `Three phases in one pass:<br>
<strong>1.</strong> Add all intervals that end before new interval starts.<br>
<strong>2.</strong> Merge all intervals that overlap with new interval.<br>
<strong>3.</strong> Add remaining intervals.`,
        solutions: {
          javascript: `function insert(intervals, newInterval) {
  const result = [];
  let i = 0, n = intervals.length;

  // Phase 1: add all before
  while (i < n && intervals[i][1] < newInterval[0]) result.push(intervals[i++]);

  // Phase 2: merge overlapping
  while (i < n && intervals[i][0] <= newInterval[1]) {
    newInterval[0] = Math.min(newInterval[0], intervals[i][0]);
    newInterval[1] = Math.max(newInterval[1], intervals[i][1]);
    i++;
  }
  result.push(newInterval);

  // Phase 3: add remaining
  while (i < n) result.push(intervals[i++]);

  return result;
}`,
          python: `def insert(intervals: list[list[int]], new_interval: list[int]) -> list[list[int]]:
    result = []
    i, n = 0, len(intervals)

    # Phase 1: add all before
    while i < n and intervals[i][1] < new_interval[0]:
        result.append(intervals[i]); i += 1

    # Phase 2: merge overlapping
    while i < n and intervals[i][0] <= new_interval[1]:
        new_interval[0] = min(new_interval[0], intervals[i][0])
        new_interval[1] = max(new_interval[1], intervals[i][1])
        i += 1
    result.append(new_interval)

    # Phase 3: remaining
    result.extend(intervals[i:])
    return result`
        }
      }
    ]
  },

  // ─── 6. Tree BFS ────────────────────────────────────────────────────────────
  {
    id: 'tree-bfs',
    name: 'Tree BFS',
    icon: '⋯',
    color: '#10b981',
    bg: 'rgba(16,185,129,.15)',
    description: 'Process a tree level by level using a queue (breadth-first).',
    problems: [
      {
        id: 'level-order',
        title: 'Binary Tree Level Order Traversal',
        difficulty: 'Medium',
        leetcode: 102,
        animId: 'bfs-level',
        tags: ['Tree', 'Queue'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        description: `Return the level-order traversal of a binary tree's values as a list of levels.

<div class="example-block">Input:  root = [3, 9, 20, null, null, 15, 7]
Output: [[3], [9, 20], [15, 7]]</div>`,
        approach: `Use a <strong>queue</strong>. For each iteration:<br>
<strong>1.</strong> Record current queue size = nodes in this level.<br>
<strong>2.</strong> Dequeue exactly that many nodes, collect their values.<br>
<strong>3.</strong> Enqueue their children.<br>
Repeat until queue is empty.`,
        solutions: {
          javascript: `function levelOrder(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];

  while (queue.length > 0) {
    const levelSize = queue.length;
    const level = [];

    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      level.push(node.val);
      if (node.left)  queue.push(node.left);
      if (node.right) queue.push(node.right);
    }

    result.push(level);
  }

  return result;
}`,
          python: `from collections import deque

def level_order(root) -> list[list[int]]:
    if not root: return []
    result = []
    queue = deque([root])

    while queue:
        level_size = len(queue)
        level = []

        for _ in range(level_size):
            node = queue.popleft()
            level.append(node.val)
            if node.left:  queue.append(node.left)
            if node.right: queue.append(node.right)

        result.append(level)

    return result`
        }
      },
      {
        id: 'right-view',
        title: 'Binary Tree Right Side View',
        difficulty: 'Medium',
        leetcode: 199,
        animId: null,
        tags: ['Tree', 'Queue'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        description: `Return the values you would see looking at the tree from the right side.

<div class="example-block">Input:  root = [1, 2, 3, null, 5, null, 4]
Output: [1, 3, 4]</div>`,
        approach: `Level-order traversal. The <strong>last node</strong> at each level is the one visible from the right.`,
        solutions: {
          javascript: `function rightSideView(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];

  while (queue.length > 0) {
    const levelSize = queue.length;

    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      if (i === levelSize - 1) result.push(node.val); // last in level
      if (node.left)  queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
  }

  return result;
}`,
          python: `from collections import deque

def right_side_view(root) -> list[int]:
    if not root: return []
    result = []
    queue = deque([root])

    while queue:
        level_size = len(queue)
        for i in range(level_size):
            node = queue.popleft()
            if i == level_size - 1:
                result.append(node.val)   # last in level
            if node.left:  queue.append(node.left)
            if node.right: queue.append(node.right)

    return result`
        }
      }
    ]
  },

  // ─── 7. Tree DFS ────────────────────────────────────────────────────────────
  {
    id: 'tree-dfs',
    name: 'Tree DFS',
    icon: '↯',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,.15)',
    description: 'Explore as deep as possible before backtracking (recursion or explicit stack).',
    problems: [
      {
        id: 'max-depth',
        title: 'Maximum Depth of Binary Tree',
        difficulty: 'Easy',
        leetcode: 104,
        animId: 'dfs-depth',
        tags: ['Tree', 'Recursion'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(h)',
        description: `Find the maximum depth (number of nodes along the longest root-to-leaf path).

<div class="example-block">Input:  root = [3, 9, 20, null, null, 15, 7]
Output: 3</div>`,
        approach: `<code>depth(node) = 1 + max(depth(left), depth(right))</code><br>
Base case: <code>null → 0</code>.<br>
Each recursive call returns the max depth of its subtree — the root returns the total height.`,
        solutions: {
          javascript: `function maxDepth(root) {
  if (root === null) return 0;

  const leftDepth  = maxDepth(root.left);
  const rightDepth = maxDepth(root.right);

  return 1 + Math.max(leftDepth, rightDepth);
}`,
          python: `def max_depth(root) -> int:
    if root is None:
        return 0

    left_depth  = max_depth(root.left)
    right_depth = max_depth(root.right)

    return 1 + max(left_depth, right_depth)`
        }
      },
      {
        id: 'path-sum',
        title: 'Path Sum',
        difficulty: 'Easy',
        leetcode: 112,
        animId: null,
        tags: ['Tree', 'Recursion'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(h)',
        description: `Determine if there is a root-to-leaf path whose node values sum to <code>targetSum</code>.

<div class="example-block">Input:  root = [5,4,8,11,null,13,4,7,2], targetSum = 22
Output: true  →  path 5→4→11→2</div>`,
        approach: `At each node, subtract its value from the target. At a leaf, check if the remaining target is 0.`,
        solutions: {
          javascript: `function hasPathSum(root, targetSum) {
  if (root === null) return false;

  const remaining = targetSum - root.val;

  if (!root.left && !root.right) // leaf
    return remaining === 0;

  return hasPathSum(root.left, remaining)
      || hasPathSum(root.right, remaining);
}`,
          python: `def has_path_sum(root, target_sum: int) -> bool:
    if root is None: return False

    remaining = target_sum - root.val

    if not root.left and not root.right:  # leaf
        return remaining == 0

    return (has_path_sum(root.left, remaining)
         or has_path_sum(root.right, remaining))`
        }
      }
    ]
  },

  // ─── 8. Dynamic Programming ─────────────────────────────────────────────────
  {
    id: 'dynamic-programming',
    name: 'Dynamic Programming',
    icon: '▦',
    color: '#f97316',
    bg: 'rgba(249,115,22,.15)',
    description: 'Break problems into overlapping subproblems; cache results to avoid recomputation.',
    problems: [
      {
        id: 'climbing-stairs',
        title: 'Climbing Stairs',
        difficulty: 'Easy',
        leetcode: 70,
        animId: 'dp-stairs',
        tags: ['DP', 'Fibonacci'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        description: `You can climb 1 or 2 steps at a time. How many distinct ways to reach step <code>n</code>?

<div class="example-block">Input:  n = 5
Output: 8</div>

<strong>Recurrence:</strong> <code>ways(n) = ways(n-1) + ways(n-2)</code> — you arrived from either the step before or two steps before. This is Fibonacci!`,
        approach: `Build a table bottom-up:<br>
<code>dp[1] = 1, dp[2] = 2</code><br>
<code>dp[i] = dp[i-1] + dp[i-2]</code> for <code>i ≥ 3</code><br>
Since we only need the last two values, we can use O(1) space.`,
        solutions: {
          javascript: `function climbStairs(n) {
  if (n <= 2) return n;

  let prev2 = 1, prev1 = 2;

  for (let i = 3; i <= n; i++) {
    const curr = prev1 + prev2;
    prev2 = prev1;
    prev1 = curr;
  }

  return prev1;
}`,
          python: `def climb_stairs(n: int) -> int:
    if n <= 2: return n

    prev2, prev1 = 1, 2

    for _ in range(3, n + 1):
        prev2, prev1 = prev1, prev1 + prev2

    return prev1`
        }
      },
      {
        id: 'coin-change',
        title: 'Coin Change',
        difficulty: 'Medium',
        leetcode: 322,
        animId: 'dp-coins',
        tags: ['DP', 'BFS'],
        timeComplexity: 'O(n·amount)',
        spaceComplexity: 'O(amount)',
        description: `Find the fewest coins needed to make up <code>amount</code>. Return <code>-1</code> if impossible.

<div class="example-block">Input:  coins = [1, 5, 6], amount = 11
Output: 2  →  [5, 6]</div>`,
        approach: `<code>dp[a]</code> = minimum coins to make amount <code>a</code>.<br>
<code>dp[0] = 0</code>; <code>dp[a] = 1 + min(dp[a-c])</code> for each coin <code>c</code>.<br>
Fill from 0 to amount.`,
        solutions: {
          javascript: `function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;

  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (coin <= a) {
        dp[a] = Math.min(dp[a], 1 + dp[a - coin]);
      }
    }
  }

  return dp[amount] === Infinity ? -1 : dp[amount];
}`,
          python: `def coin_change(coins: list[int], amount: int) -> int:
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0

    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a:
                dp[a] = min(dp[a], 1 + dp[a - coin])

    return -1 if dp[amount] == float('inf') else dp[amount]`
        }
      },
      {
        id: 'longest-common-subseq',
        title: 'Longest Common Subsequence',
        difficulty: 'Medium',
        leetcode: 1143,
        animId: null,
        tags: ['DP', 'String'],
        timeComplexity: 'O(m·n)',
        spaceComplexity: 'O(m·n)',
        description: `Given two strings, find the length of their longest common subsequence.

<div class="example-block">Input:  text1 = "abcde", text2 = "ace"
Output: 3  →  "ace"</div>`,
        approach: `<code>dp[i][j]</code> = LCS of <code>text1[0..i-1]</code> and <code>text2[0..j-1]</code>.<br>
If chars match: <code>dp[i][j] = 1 + dp[i-1][j-1]</code><br>
Else: <code>dp[i][j] = max(dp[i-1][j], dp[i][j-1])</code>`,
        solutions: {
          javascript: `function longestCommonSubsequence(text1, text2) {
  const m = text1.length, n = text2.length;
  const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (text1[i-1] === text2[j-1])
        dp[i][j] = 1 + dp[i-1][j-1];
      else
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }

  return dp[m][n];
}`,
          python: `def longest_common_subsequence(text1: str, text2: str) -> int:
    m, n = len(text1), len(text2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if text1[i-1] == text2[j-1]:
                dp[i][j] = 1 + dp[i-1][j-1]
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])

    return dp[m][n]`
        }
      }
    ]
  },

  // ─── 9. Backtracking ────────────────────────────────────────────────────────
  {
    id: 'backtracking',
    name: 'Backtracking',
    icon: '⤺',
    color: '#ef4444',
    bg: 'rgba(239,68,68,.15)',
    description: 'Explore all possibilities by building candidates and abandoning invalid ones early.',
    problems: [
      {
        id: 'permutations',
        title: 'Permutations',
        difficulty: 'Medium',
        leetcode: 46,
        animId: 'bt-perms',
        tags: ['Recursion', 'Backtracking'],
        timeComplexity: 'O(n · n!)',
        spaceComplexity: 'O(n)',
        description: `Given an array of distinct integers, return all possible permutations.

<div class="example-block">Input:  nums = [1, 2, 3]
Output: [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]</div>`,
        approach: `At each step, pick any unused number and append it to the current path.<br>
When path length equals n → record the permutation.<br>
<strong>Backtrack</strong> by removing the last choice and trying the next option.`,
        solutions: {
          javascript: `function permute(nums) {
  const result = [];

  function backtrack(current, remaining) {
    if (remaining.length === 0) {
      result.push([...current]);
      return;
    }

    for (let i = 0; i < remaining.length; i++) {
      current.push(remaining[i]);
      backtrack(current, [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
      current.pop(); // backtrack
    }
  }

  backtrack([], nums);
  return result;
}`,
          python: `def permute(nums: list[int]) -> list[list[int]]:
    result = []

    def backtrack(current: list[int], remaining: list[int]):
        if not remaining:
            result.append(current[:])
            return

        for i, num in enumerate(remaining):
            current.append(num)
            backtrack(current, remaining[:i] + remaining[i+1:])
            current.pop()   # backtrack

    backtrack([], nums)
    return result`
        }
      },
      {
        id: 'subsets',
        title: 'Subsets',
        difficulty: 'Medium',
        leetcode: 78,
        animId: null,
        tags: ['Recursion', 'Bit Manipulation'],
        timeComplexity: 'O(n · 2ⁿ)',
        spaceComplexity: 'O(n)',
        description: `Given a set of unique integers, return all possible subsets.

<div class="example-block">Input:  nums = [1, 2, 3]
Output: [[], [1], [2], [1,2], [3], [1,3], [2,3], [1,2,3]]</div>`,
        approach: `At each index, make a binary choice: <strong>include</strong> or <strong>exclude</strong> the number.<br>
This builds a decision tree of depth n → 2ⁿ leaves.`,
        solutions: {
          javascript: `function subsets(nums) {
  const result = [];

  function backtrack(start, current) {
    result.push([...current]); // every state is a valid subset

    for (let i = start; i < nums.length; i++) {
      current.push(nums[i]);
      backtrack(i + 1, current);
      current.pop(); // backtrack
    }
  }

  backtrack(0, []);
  return result;
}`,
          python: `def subsets(nums: list[int]) -> list[list[int]]:
    result = []

    def backtrack(start: int, current: list[int]):
        result.append(current[:])   # every state is valid

        for i in range(start, len(nums)):
            current.append(nums[i])
            backtrack(i + 1, current)
            current.pop()           # backtrack

    backtrack(0, [])
    return result`
        }
      }
    ]
  },

  // ─── 10. Graph ──────────────────────────────────────────────────────────────
  {
    id: 'graph',
    name: 'Graph BFS / DFS',
    icon: '◎',
    color: '#14b8a6',
    bg: 'rgba(20,184,166,.15)',
    description: 'Explore graphs level-by-level (BFS) or depth-first (DFS) to find paths, cycles, or components.',
    problems: [
      {
        id: 'num-islands',
        title: 'Number of Islands',
        difficulty: 'Medium',
        leetcode: 200,
        animId: 'graph-islands',
        tags: ['Grid', 'BFS', 'DFS'],
        timeComplexity: 'O(m·n)',
        spaceComplexity: 'O(m·n)',
        description: `Given a 2D grid of <code>'1'</code> (land) and <code>'0'</code> (water), count the number of islands.

<div class="example-block">Input:
  11110
  11010
  11000
  00000
Output: 1</div>`,
        approach: `For each unvisited <code>'1'</code>, start a BFS/DFS to mark the entire island as visited (change to <code>'0'</code>), then increment the count. Each BFS call covers one island.`,
        solutions: {
          javascript: `function numIslands(grid) {
  let count = 0;
  const rows = grid.length, cols = grid[0].length;

  function dfs(r, c) {
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] === '0') return;
    grid[r][c] = '0'; // mark visited
    dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '1') {
        dfs(r, c);
        count++;
      }
    }
  }

  return count;
}`,
          python: `def num_islands(grid: list[list[str]]) -> int:
    rows, cols = len(grid), len(grid[0])
    count = 0

    def dfs(r: int, c: int):
        if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] == '0':
            return
        grid[r][c] = '0'   # mark visited
        dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1)

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                dfs(r, c)
                count += 1

    return count`
        }
      },
      {
        id: 'course-schedule',
        title: 'Course Schedule',
        difficulty: 'Medium',
        leetcode: 207,
        animId: null,
        tags: ['Graph', 'Topological Sort'],
        timeComplexity: 'O(V+E)',
        spaceComplexity: 'O(V+E)',
        description: `Given <code>numCourses</code> and prerequisites, can you finish all courses?

<div class="example-block">Input:  numCourses = 2, prerequisites = [[1,0]]
Output: true  →  take 0 first, then 1</div>`,
        approach: `Detect a cycle in a directed graph using DFS with three states:<br>
<code>0 = unvisited</code>, <code>1 = visiting</code> (in current DFS path), <code>2 = done</code>.<br>
If we visit a node in state <code>1</code> → cycle → return false.`,
        solutions: {
          javascript: `function canFinish(numCourses, prerequisites) {
  const adj = Array.from({length: numCourses}, () => []);
  for (const [a, b] of prerequisites) adj[b].push(a);

  const state = new Array(numCourses).fill(0); // 0 unvisited, 1 visiting, 2 done

  function dfs(node) {
    if (state[node] === 1) return false; // cycle!
    if (state[node] === 2) return true;

    state[node] = 1;
    for (const neighbor of adj[node]) {
      if (!dfs(neighbor)) return false;
    }
    state[node] = 2;
    return true;
  }

  for (let i = 0; i < numCourses; i++) {
    if (!dfs(i)) return false;
  }

  return true;
}`,
          python: `def can_finish(num_courses: int, prerequisites: list[list[int]]) -> bool:
    adj = [[] for _ in range(num_courses)]
    for a, b in prerequisites:
        adj[b].append(a)

    state = [0] * num_courses  # 0 unvisited, 1 visiting, 2 done

    def dfs(node: int) -> bool:
        if state[node] == 1: return False   # cycle!
        if state[node] == 2: return True

        state[node] = 1
        for neighbor in adj[node]:
            if not dfs(neighbor): return False
        state[node] = 2
        return True

    return all(dfs(i) for i in range(num_courses))`
        }
      }
    ]
  },

  // ─── 11. Stack ──────────────────────────────────────────────────────────────
  {
    id: 'stack',
    name: 'Stack',
    icon: '⫠',
    color: '#a855f7',
    bg: 'rgba(168,85,247,.15)',
    description: 'Use a LIFO stack to track "most recent" elements — great for matching and span problems.',
    problems: [
      {
        id: 'valid-parentheses',
        title: 'Valid Parentheses',
        difficulty: 'Easy',
        leetcode: 20,
        animId: 'stack-parens',
        tags: ['Stack', 'String'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        description: `Determine if a string of brackets is valid (every open bracket has a matching close bracket in the correct order).

<div class="example-block">Input:  s = "()[]{}"  → true
Input:  s = "([)]"   → false
Input:  s = "{[]}"   → true</div>`,
        approach: `For each character:<br>
• Opening bracket → <strong>push</strong> its expected closing bracket.<br>
• Closing bracket → <strong>pop</strong> and check it matches.<br>
At the end, the stack must be empty.`,
        solutions: {
          javascript: `function isValid(s) {
  const stack = [];
  const map = { ')': '(', ']': '[', '}': '{' };

  for (const ch of s) {
    if ('([{'.includes(ch)) {
      stack.push(ch);
    } else {
      if (stack.pop() !== map[ch]) return false;
    }
  }

  return stack.length === 0;
}`,
          python: `def is_valid(s: str) -> bool:
    stack = []
    mapping = {')': '(', ']': '[', '}': '{'}

    for ch in s:
        if ch in '([{':
            stack.append(ch)
        else:
            if not stack or stack.pop() != mapping[ch]:
                return False

    return len(stack) == 0`
        }
      },
      {
        id: 'next-greater',
        title: 'Next Greater Element I',
        difficulty: 'Easy',
        leetcode: 496,
        animId: null,
        tags: ['Stack', 'Monotonic Stack'],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        description: `For each element in <code>nums1</code>, find the first greater element to its right in <code>nums2</code>.

<div class="example-block">Input:  nums1 = [4,1,2], nums2 = [1,3,4,2]
Output: [-1,3,-1]</div>`,
        approach: `Use a <strong>monotonic decreasing stack</strong>. Process <code>nums2</code>: while current element is greater than stack top → the stack top found its next greater. Store results in a map, then answer queries for <code>nums1</code>.`,
        solutions: {
          javascript: `function nextGreaterElement(nums1, nums2) {
  const map = {};   // num → its next greater in nums2
  const stack = [];

  for (const num of nums2) {
    while (stack.length && stack[stack.length - 1] < num) {
      map[stack.pop()] = num; // 'num' is the next greater
    }
    stack.push(num);
  }

  return nums1.map(n => map[n] ?? -1);
}`,
          python: `def next_greater_element(nums1: list[int], nums2: list[int]) -> list[int]:
    mapping = {}   # num → its next greater in nums2
    stack = []

    for num in nums2:
        while stack and stack[-1] < num:
            mapping[stack.pop()] = num  # 'num' is the next greater
        stack.append(num)

    return [mapping.get(n, -1) for n in nums1]`
        }
      }
    ]
  },

  // ─── 12. Heap ───────────────────────────────────────────────────────────────
  {
    id: 'heap',
    name: 'Heap / Priority Queue',
    icon: '△',
    color: '#fb923c',
    bg: 'rgba(251,146,60,.15)',
    description: 'Keep track of the k smallest or largest elements efficiently using a heap.',
    problems: [
      {
        id: 'kth-largest',
        title: 'Kth Largest Element in an Array',
        difficulty: 'Medium',
        leetcode: 215,
        animId: 'heap-kth',
        tags: ['Heap', 'Sorting'],
        timeComplexity: 'O(n log k)',
        spaceComplexity: 'O(k)',
        description: `Find the <code>k</code>th largest element in an unsorted array.

<div class="example-block">Input:  nums = [3,2,1,5,6,4], k = 2
Output: 5</div>

<strong>Key insight:</strong> A min-heap of size k keeps the k largest elements seen so far. Its top is always the kth largest.`,
        approach: `Maintain a min-heap of size <code>k</code>.<br>
• Add each element.<br>
• If heap size exceeds <code>k</code>, remove the minimum.<br>
• After processing all elements, the heap's minimum is the kth largest.`,
        solutions: {
          javascript: `// JS doesn't have a built-in heap, so we simulate with sorted array
// In interviews, describe the O(n log k) heap approach below.
function findKthLargest(nums, k) {
  // Min-heap simulation (real interviews: use a proper heap library)
  const heap = [];

  const push = (val) => {
    heap.push(val);
    heap.sort((a, b) => a - b); // O(k log k) — use real heap for O(log k)
    if (heap.length > k) heap.shift();
  };

  for (const num of nums) push(num);
  return heap[0]; // smallest in heap = kth largest overall
}`,
          python: `import heapq

def find_kth_largest(nums: list[int], k: int) -> int:
    heap = []  # min-heap of size k

    for num in nums:
        heapq.heappush(heap, num)
        if len(heap) > k:
            heapq.heappop(heap)   # remove minimum

    return heap[0]  # top of min-heap = kth largest`
        }
      },
      {
        id: 'top-k-freq',
        title: 'Top K Frequent Elements',
        difficulty: 'Medium',
        leetcode: 347,
        animId: null,
        tags: ['Heap', 'Hash Map'],
        timeComplexity: 'O(n log k)',
        spaceComplexity: 'O(n)',
        description: `Given an integer array, return the <code>k</code> most frequent elements.

<div class="example-block">Input:  nums = [1,1,1,2,2,3], k = 2
Output: [1, 2]</div>`,
        approach: `<strong>1.</strong> Count frequencies using a hash map.<br>
<strong>2.</strong> Use a min-heap of size k keyed by frequency.<br>
<strong>3.</strong> If heap size > k, pop the minimum frequency element.<br>
Result: the k elements remaining in the heap.`,
        solutions: {
          javascript: `function topKFrequent(nums, k) {
  const freq = {};
  for (const n of nums) freq[n] = (freq[n] || 0) + 1;

  // Sort by frequency descending (heap simulation)
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([num]) => Number(num));
}`,
          python: `from collections import Counter
import heapq

def top_k_frequent(nums: list[int], k: int) -> list[int]:
    freq = Counter(nums)

    # Min-heap keyed by frequency
    heap = []
    for num, count in freq.items():
        heapq.heappush(heap, (count, num))
        if len(heap) > k:
            heapq.heappop(heap)

    return [num for _, num in heap]`
        }
      }
    ]
  }
];
