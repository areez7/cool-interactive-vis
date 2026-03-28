d3.csv("data/phone-usage.csv").then((data) => {
  // Parse data
  data.forEach((d) => {
    d.datetime = new Date(`${d.date}T${d.time}`);
    d.hour = d.datetime.getHours();
    d.day = d.datetime.getDay() + 1;
    d.duration = +d.duration_sec;
  });

  const filteredData = data.filter((d) => d.day >= 1 && d.day <= 5);

  // Aggregate counts (day, hour)
  const counts = d3.rollup(
    filteredData,
    (v) => {
      const count = v.length;
      const totalDuration = d3.sum(v, (d) => Math.max(d.duration, 30));

      return Math.sqrt(count * totalDuration);
    },
    (d) => d.day,
    (d) => d.hour,
  );

  const width = 700;
  const height = 370;
  const margin = { top: 80, right: 60, bottom: 100, left: 70 };

  const svg = d3.select("#heatmap");
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const dayMap = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };
  const timelineSvg = d3.select("#timeline");
  const timelineLayer = timelineSvg.append("g");
  const legendLayer = timelineSvg.append("g");

  const appColor = d3
    .scaleOrdinal()
    .domain([...new Set(data.map((d) => d.app))])
    .range([
      "#5A7DA8", // Messages (blue)
      "#E6953B", // News (orange)
      "#D65C5C", // YouTube (red)
      "#7FB8B3", // Gmail (teal)
    ]);

  // calendar cells
  const cells = [];

  for (let day = 1; day <= 5; day++) {
    for (let hour = 9; hour <= 16; hour++) {
      const count = counts.get(day)?.get(hour) || 0;
      cells.push({ day, hour, count });
    }
  }

  // scales
  const x = d3
    .scaleBand()
    .domain(dayNames)
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const y = d3
    .scaleBand()
    .domain(d3.range(9, 17))
    .range([margin.top, height - margin.bottom])
    .padding(0.05);

  const maxCount = d3.max(cells, (d) => d.count);

  const color = d3
    .scaleSequential(d3.interpolateYlGnBu)
    .domain([0, maxCount])
    .interpolator((t) => d3.interpolatePurples(Math.pow(t, 0.6)));

  // title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 17)
    .attr("text-anchor", "middle")
    .attr("font-size", "16px")
    .attr("font-weight", "bold")
    .text("Phone Check Frequency (Workday Calendar View)");

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 40)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("fill", "#666")
    .text("Click a block to view detailed timeline");

  // hour grid lines
  svg
    .selectAll(".grid-line")
    .data(d3.range(9, 18))
    .enter()
    .append("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", (d) => (d === 17 ? y(16) + y.bandwidth() : y(d)))
    .attr("y2", (d) => (d === 17 ? y(16) + y.bandwidth() : y(d)))
    .attr("stroke", "#ddd");

  // day separator lines
  const boundaries = [];

  // left edge of Monday
  boundaries.push(margin.left + 11);

  // internal dividers (Tue–Fri)
  dayNames.slice(1).forEach((d) => {
    boundaries.push(x(d));
  });

  // right edge of Friday
  boundaries.push(width - margin.right);

  svg
    .selectAll(".day-divider")
    .data(boundaries)
    .enter()
    .append("line")
    .attr("class", "day-divider")
    .attr("x1", (d) => d - 6)
    .attr("x2", (d) => d - 6)
    .attr("y1", y(9) - 5)
    .attr("y2", y(16) + y.bandwidth())
    .attr("stroke", "#ddd")
    .attr("stroke-width", 1);

  // draw blocks
  svg
    .selectAll("rect.cell")
    .data(cells)
    .enter()
    .append("rect")
    .attr("class", "cell")
    .attr("x", (d) => x(dayMap[d.day]))
    .attr("y", (d) => y(d.hour))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 4)
    .attr("fill", (d) => color(d.count))
    .attr("stroke", "#ddd")
    .on("click", (event, d) => {
      updateTimeline(d.day, d.hour);
    })
    .on("mouseover", function () {
      d3.select(this).attr("stroke", "black");
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke", "#ddd");
    });

  // day labels
  svg
    .selectAll(".day-label")
    .data(dayNames)
    .enter()
    .append("text")
    .attr("x", (d) => x(d) + x.bandwidth() / 2)
    .attr("y", margin.top - 5)
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .text((d) => d);

  // hour labels
  svg
    .selectAll(".hour-label")
    .data(d3.range(9, 18))
    .enter()
    .append("text")
    .attr("class", "hour-label")
    .attr("x", margin.left - 10)
    .attr("y", (d) => (d === 17 ? y(16) + y.bandwidth() : y(d)))
    .attr("text-anchor", "end")
    .attr("alignment-baseline", "middle")
    .text((d) => `${d}:00`)
    .attr("font-size", "10px")
    .attr("fill", "#888");

  // colour legend
  const legendWidth = 200;
  const legendScale = d3.scaleLinear().domain([0, 400]).range([0, legendWidth]);

  const legendGroup = svg
    .append("g")
    .attr("transform", `translate(${width / 2 - 100}, ${height - 70})`);

  const defs = svg.append("defs");

  const gradient = defs.append("linearGradient").attr("id", "heatmap-gradient");

  gradient
    .selectAll("stop")
    .data(d3.range(0, 1.01, 0.1))
    .enter()
    .append("stop")
    .attr("offset", (d) => `${d * 100}%`)
    .attr("stop-color", (d) => color(d * maxCount));

  legendGroup
    .append("rect")
    .attr("width", legendWidth)
    .attr("height", 10)
    .style("fill", "url(#heatmap-gradient)");

  legendGroup
    .append("g")
    .attr("transform", "translate(0, 10)")
    .call(d3.axisBottom(legendScale).ticks(5));

  legendGroup
    .append("text")
    .attr("y", -5)
    .attr("font-size", "12px")
    .text("Engagement score (frequency x duration)");

  const apps = [...new Set(data.map((d) => d.app))];

  const legend = legendLayer
    .selectAll(".legend")
    .data(apps)
    .enter()
    .append("g")
    .attr("transform", (d, i) => {
      const perRow = 4;
      const row = Math.floor(i / perRow);
      const col = i % perRow;

      return `translate(${50 + col * 150}, ${120 + row * 20})`;
    });

  legend
    .append("rect")
    .attr("width", 10)
    .attr("height", 10)
    .attr("fill", (d) => appColor(d));

  legend
    .append("text")
    .attr("x", 15)
    .attr("y", 10)
    .text((d) => d);

  function updateTimeline(day, hour) {
    const filtered = data.filter((d) => d.day === day && d.hour === hour);

    filtered.sort((a, b) => d3.ascending(a.datetime, b.datetime));

    timelineLayer.selectAll("*").remove();

    timelineLayer
      .append("line")
      .attr("x1", 50)
      .attr("x2", 650)
      .attr("y1", 60)
      .attr("y2", 60)
      .attr("stroke", "#999")
      .attr("stroke-width", 2);

    let gaps = [];

    for (let i = 1; i < filtered.length; i++) {
      const prev = new Date(filtered[i - 1].date);
      const curr = new Date(filtered[i].date);

      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

      if (diffDays > 1) {
        gaps.push({ index: i, gap: diffDays });
      }
    }

    const x = d3
      .scaleLinear()
      .domain([0, filtered.length - 1])
      .range([50, 650]);

    gaps.forEach((d) => {
      timelineLayer
        .append("line")
        .attr("x1", (x(d.index - 1) + x(d.index)) / 2)
        .attr("x2", (x(d.index - 1) + x(d.index)) / 2)
        .attr("y1", 40)
        .attr("y2", 80)
        .attr("stroke", "#444")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "4,2");

      timelineLayer
        .append("text")
        .attr("x", (x(d.index - 1) + x(d.index)) / 2 + 2)
        .attr("y", 35)
        .attr("font-size", "10px")
        .text(`+${d.gap}`);
    });

    const rScale = d3
      .scaleSqrt()
      .domain([0, d3.max(filtered, (d) => d.duration)])
      .range([4, 10]);

    timelineLayer
      .selectAll("circle")
      .data(filtered)
      .enter()
      .append("circle")
      .attr("cx", (d, i) => x(i))
      .attr("cy", 60)
      .attr("r", (d) => rScale(d.duration))
      .attr("fill", (d) => appColor(d.app))
      .attr("opacity", 0.9)
      .attr("stroke", "#ddd")
      .attr("stroke-width", 0.5)
      .on("mouseover", (event, d) => {
        const mins = Math.floor(d.duration / 60);
        const secs = d.duration % 60;

        d3.select("#tooltip")
          .style("opacity", 1)
          .html(
            `${d.app} duration<br>${mins}:${secs.toString().padStart(2, "0")}<br>${d.date}`,
          );
      })
      .on("mousemove", (event) => {
        d3.select("#tooltip")
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + 10 + "px");
      })
      .on("mouseout", () => {
        d3.select("#tooltip").style("opacity", 0);
      });

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    const formatHour = (h) => {
      const next = (h + 1) % 24;
      return `${h}:00–${next}:00`;
    };

    timelineLayer
      .append("text")
      .attr("x", 50)
      .attr("y", 15)
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text(`${days[day - 1]}, ${formatHour(hour)}`);
  }
});
