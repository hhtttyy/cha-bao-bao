Component({
  props: { selected: 0 },
  methods: {
    go(e) {
      const path = e.currentTarget.dataset.path;
      my.switchTab({ url: path });
    }
  }
});