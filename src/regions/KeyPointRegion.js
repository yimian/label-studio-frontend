import React, { Fragment } from "react";
import { Circle } from "react-konva";
import { observer, inject } from "mobx-react";
import { types, getParentOfType, getRoot } from "mobx-state-tree";

import WithStatesMixin from "../mixins/WithStates";
import Constants from "../core/Constants";
import NormalizationMixin from "../mixins/Normalization";
import RegionsMixin from "../mixins/Regions";
import Registry from "../core/Registry";
import { ImageModel } from "../tags/object/Image";
import { KeyPointLabelsModel } from "../tags/control/KeyPointLabels";
import { guidGenerator } from "../core/Helpers";
import { LabelOnKP } from "../components/ImageView/LabelOnRegion";

const Model = types
  .model({
    id: types.optional(types.identifier, guidGenerator),
    pid: types.optional(types.string, guidGenerator),
    type: "keypointregion",

    x: types.number,
    y: types.number,

    relativeX: types.optional(types.number, 0),
    relativeY: types.optional(types.number, 0),

    width: types.number,

    opacity: types.number,
    fillColor: types.maybeNull(types.string),

    states: types.maybeNull(types.array(types.union(KeyPointLabelsModel))),

    sw: types.maybeNull(types.number),
    sh: types.maybeNull(types.number),

    coordstype: types.optional(types.enumeration(["px", "perc"]), "px"),
  })
  .views(self => ({
    get parent() {
      return getParentOfType(self, ImageModel);
    },

    get completion() {
      return getRoot(self).completionStore.selected;
    },
  }))
  .actions(self => ({
    unselectRegion() {
      self.selected = false;
      self.parent.setSelected(undefined);
      self.completion.setHighlightedNode(null);
      self.completion.unloadRegionState(self);
    },

    selectRegion() {
      self.selected = true;
      self.completion.setHighlightedNode(self);
      self.parent.setSelected(self.id);
      self.completion.loadRegionState(self);
    },

    updateAppearenceFromState() {
      const stroke = self.states[0].getSelectedColor();
      self.strokeColor = stroke;
      self.fillColor = stroke;
    },

    setPosition(x, y) {
      self.x = x;
      self.y = y;
    },

    addState(state) {
      self.states.push(state);
    },

    setFill(color) {
      self.fill = color;
    },

    afterAttach() {
      if (self.coordstype === "perc") {
        self.relativeX = self.x;
        self.relativeY = self.y;
      }

      if (self.coordstype === "px") {
        self.relativeX = (self.x / self.parent.stageWidth) * 100;
        self.relativeY = (self.y / self.parent.stageHeight) * 100;
      }
    },

    updateImageSize(wp, hp, sw, sh) {
      // self.wp = wp;
      // self.hp = hp;

      self.sw = sw;
      self.sh = sh;

      if (self.coordstype === "px") {
        self.x = (sw * self.relativeX) / 100;
        self.y = (sh * self.relativeY) / 100;
      }

      if (!self.completion.sentUserGenerate && self.coordstype === "perc") {
        self.x = (sw * self.x) / 100;
        self.y = (sh * self.y) / 100;
        self.width = (sw * self.width) / 100;
        self.coordstype = "px";
      }
    },

    serialize(control, object) {
      return {
        original_width: object.naturalWidth,
        original_height: object.naturalHeight,

        value: {
          x: (self.x * 100) / object.stageWidth,
          y: (self.y * 100) / object.stageHeight,
          width: (self.width * 100) / object.stageWidth, //  * (self.scaleX || 1)
          ketpointlabels: control.getSelectedNames(),
        },
      };
    },
  }));

const KeyPointRegionModel = types.compose(
  "KeyPointRegionModel",
  WithStatesMixin,
  RegionsMixin,
  NormalizationMixin,
  Model,
);

const HtxKeyPointView = ({ store, item }) => {
  const x = item.x;
  const y = item.y;

  const props = {};

  props["opacity"] = item.opacity;

  if (item.fillColor) {
    props["fill"] = item.fillColor;
  }

  props["stroke"] = item.strokeColor;
  props["strokeWidth"] = item.strokeWidth;
  props["strokeScaleEnabled"] = false;
  props["shadowBlur"] = 0;

  if (item.highlighted) {
    props["stroke"] = Constants.HIGHLIGHTED_STROKE_COLOR;
    props["strokeWidth"] = Constants.HIGHLIGHTED_STROKE_WIDTH;
  }

  return (
    <Fragment>
      <Circle
        x={x}
        y={y}
        radius={item.width}
        scaleX={1 / item.parent.zoomScale}
        scaleY={1 / item.parent.zoomScale}
        name={item.id}
        onDragEnd={e => {
          const t = e.target;
          item.setPosition(t.getAttr("x"), t.getAttr("y"));
        }}
        dragBoundFunc={function(pos) {
          const r = item.parent.stageWidth;
          const b = item.parent.stageHeight;

          let { x, y } = pos;

          if (x < 0) x = 0;
          if (y < 0) y = 0;

          if (x > r) x = r;
          if (y > b) y = b;

          return {
            x: x,
            y: y,
          };
        }}
        onMouseOver={e => {
          const stage = item.parent.stageRef;

          if (store.completionStore.selected.relationMode) {
            item.setHighlight(true);
            stage.container().style.cursor = "crosshair";
          } else {
            stage.container().style.cursor = "pointer";
          }
        }}
        onMouseOut={e => {
          const stage = item.parent.stageRef;
          stage.container().style.cursor = "default";

          if (store.completionStore.selected.relationMode) {
            item.setHighlight(false);
          }
        }}
        onClick={e => {
          const stage = item.parent.stageRef;

          if (!item.completion.editable) return;

          if (store.completionStore.selected.relationMode) {
            stage.container().style.cursor = "default";
          }

          item.setHighlight(false);
          item.onClickRegion();
        }}
        {...props}
        draggable={item.editable}
      />
      <LabelOnKP item={item} />
    </Fragment>
  );
};

const HtxKeyPoint = inject("store")(observer(HtxKeyPointView));

Registry.addTag("keypointregion", KeyPointRegionModel, HtxKeyPoint);

export { KeyPointRegionModel, HtxKeyPoint };
