<h1 style="font-family: Verdana,sans-serif;">♻️ Idiomorph</h1>

Idiomorph is a javascript library for morphing one DOM tree to another.  It is inspired by other libraries that 
pioneered this functionality:

* [morphdom](https://github.com/patrick-steele-idem/morphdom) - the original DOM morphing library
* [nanomorph](https://github.com/choojs/nanomorph) - an updated take on morphdom

Both morphdom and nanomorph use the `id` property of a node to match up elements within a given set of sibling nodes.  When
an id match is found, the existing element is not removed from the DOM, but is instead morphed in place to the new content.
This preserves the node in the DOM, and allows state (such as focus) to be retained. 

However, in both these algorithms, the structure of the _children_ of sibling nodes is not considered when morphing two 
nodes: only the ids of the nodes are considered.  This is due to performance: it is not feasible to recurse through all 
the children of siblings when matching things up. 

## id sets

Idiomorph takes a different approach: before node-matching occurs, both the new content and the old content
are processed to create _id sets_, a mapping of elements to _a set of all ids found within that element_.  That is, the
set of all ids in all children of the element, plus the element's id, if any.

Id sets can be computed relatively efficiently via a query selector + a bottom up algorithm.

Given an id set, you can now adopt a broader sense of "matching" than simply using id matching: if the intersection between
the id sets of element 1 and element 2 is non-empty, they match.  This allows Idiomorph to relatively quickly match elements
based on structural information from children, who contribute to a parent's id set, which allows for better overall matching
when compared with simple id-based matching.

A testimonial:

> We are indeed using idiomorph and we'll include it officially as part of [Turbo 8](https://turbo.hotwired.dev/). We 
> started with morphdom, but eventually switched to idiomorph as we found it way more suitable. It just worked great 
> with all the tests we threw at it, while morphdom was incredibly picky about "ids" to match nodes. Also, we noticed 
> it's at least as fast.
> 
> -- [Jorge Marubia](https://www.jorgemanrubia.com/) / [37Signals](https://37signals.com/)

## Installing

Idiomorph can be installed via NPM or your favorite dependency management system under the `idiomorph` dependency 
name.

```js
require("idiomorph"); // CommonJS
import "idiomorph"; // ESM
```

## Usage

Idiomorph has a very simple API:

```js
  Idiomorph.morph(existingNode, newNode);
```

This will morph the existingNode to have the same structure as the newNode.  Note that this is a destructive operation
with respect to both the existingNode and the newNode.

You can also pass string content in as the second argument, and Idiomorph will parse the string into nodes:

```js
  Idiomorph.morph(existingNode, "<div>New Content</div>");
```

And it will be parsed and merged into the new content.

If you wish to target the `innerHTML` rather than the `outerHTML` of the content, you can pass in a `morphStyle` 
in a third config argument:

```js
  Idiomorph.morph(existingNode, "<div>New Content</div>", {morphStyle:'innerHTML'});
```

This will replace the _inner_ content of the existing node with the new content.

### Options

Idiomorph supports the following options:

| option (with default)         | meaning                                                                                                    | example                                                                  |
|-------------------------------|------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| `morphStyle: 'outerHTML'`     | The style of morphing to use, either `outerHTML` or `innerHTML`                                            | `Idiomorph.morph(..., {morphStyle:'innerHTML'})`                         |
| `ignoreActive: false`         | If `true`, idiomorph will skip the active element                                                          | `Idiomorph.morph(..., {ignoreActive:true})`                              |
| `ignoreActiveValue: false`    | If `true`, idiomorph will not update the active element's value                                            | `Idiomorph.morph(..., {ignoreActiveValue:true})`                         |
| `restoreFocus: true`          | If `true`, idiomorph will attempt to restore any lost focus and selection state after the morph.           | `Idiomorph.morph(..., {restoreFocus:true})`                              |
| `head: {style: 'merge', ...}` | Allows you to control how the `head` tag is merged. See the [head](#the-head-tag) section for more details | `Idiomorph.morph(..., {head:{style:'merge'}})`                           |
| `callbacks: {...}`            | Allows you to insert callbacks when events occur in the morph lifecycle. See the callback table below      | `Idiomorph.morph(..., {callbacks:{beforeNodeAdded:function(node){...}})` |

#### Callbacks

Idiomorph provides the following callbacks, which can be used to intercept and, for some callbacks, modify the swapping behavior
of the algorithm.

| callback                                                  | description                                                                                                    | return value meaning                               |
|-----------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|----------------------------------------------------|
| beforeNodeAdded(node)                                     | Called before a new node is added to the DOM                                                                   | return false to not add the node                   |
| afterNodeAdded(node)                                      | Called after a new node is added to the DOM                                                                    | none                                               |
| beforeNodeMorphed(oldNode, newNode)                       | Called before a node is morphed in the DOM                                                                     | return false to skip morphing the node             |
| afterNodeMorphed(oldNode, newNode)                        | Called after a node is morphed in the DOM                                                                      | none                                               |
| beforeNodeRemoved(node)                                   | Called before a node is removed from the DOM                                                                   | return false to not remove the node                |
| afterNodeRemoved(node)                                    | Called after a node is removed from the DOM                                                                    | none                                               |
| beforeAttributeUpdated(attributeName, node, mutationType) | Called before an attribute on an element is updated or removed (`mutationType` is either "update" or "remove") | return false to not update or remove the attribute |

### The `head` tag

The head tag is treated specially by idiomorph because:

* It typically only has one level of children within it
* Those children often do not have `id` attributes associated with them
* It is important to remove as few elements as possible from the head, in order to minimize network requests for things
  like style sheets
* The order of elements in the head tag is (usually) not meaningful

Because of this, by default, idiomorph adopts a `merge` algorithm between two head tags, `old` and `new`:

* Elements that are in both `old` and `new` are ignored
* Elements that are in `new` but not in `old` are added to `old`
* Elements that are in `old` but not in `new` are removed from `old`

Thus the content of the two head tags will be the same, but the order of those elements will not be.

#### Attribute Based Fine-Grained Head Control

Sometimes you may want even more fine-grained control over head merging behavior.  For example, you may want a script
tag to re-evaluate, even though it is in both `old` and `new`.  To do this, you can add the attribute `im-re-append='true'`
to the script tag, and idiomorph will re-append the script tag even if it exists in both head tags, forcing re-evaluation
of the script.

Similarly, you may wish to preserve an element even if it is not in `new`.  You can use the attribute `im-preserve='true'`
in this case to retain the element.

#### Additional Configuration

You are also able to override these behaviors, see the `head` config object in the source code.

You can set `head.style` to:

* `merge` - the default algorithm outlined above
* `append` - simply append all content in `new` to `old`
* `morph` - adopt the normal idiomorph morphing algorithm for the head
* `none` - ignore the head tag entirely

For example, if you wanted to merge a whole page using the `morph` algorithm for the head tag, you would do this:

```js
Idiomorph.morph(document.documentElement, newPageSource, {head:{style: 'morph'}})
```

The `head` object also offers callbacks for configuring head merging specifics.

### Setting Defaults

All the behaviors specified above can be set to a different default by mutating the `Idiomorph.defaults` object, including
the `Idiomorph.defaults.callbacks` and `Idiomorph.defaults.head` objects.

## Performance

Idiomorph is not designed to be as fast as either morphdom or nanomorph.  Rather, its goals are:

* Better DOM tree matching
* Relatively simple code

Performance is a consideration, but better matching is the reason Idiomorph was created.  Our benchmarks indicate that
it is approximately equal to 10% slower than morphdom for large DOM morphs, and equal to or faster than morphdom for 
smaller morphs. See the [Performance](PERFORMANCE.md) document for more details.
