import React from 'react'
import PropTypes from 'prop-types';
import { enableScroll } from './songdetailView';
import { deleteRSSongList, createRSSongList, executeRawSql } from '../sqliteService';

export function generateSql(filters, count = false) {
  const countsql = count ? "count(*) as acount, count(distinct songkey) as songcount" : "*"
  let sql = `select ${countsql} from songs_owned `;
  for (let i = 0; i < filters.length; i += 1) {
    const filter = filters[i];
    if (i === 0) {
      sql += " where "
    }
    switch (filter.type) {
      case "artist":
      case "album":
      case "song":
      case "arrangement":
        sql += `${filter.type} ${filter.cmp} '%${escape(filter.value)}%' `;
        break;
      case "mastery":
        sql += `coalesce(${filter.type},0) ${filter.cmp} ${filter.value / 100} `;
        break;
      case "difficulty":
      case "count":
      case "tempo":
        sql += `coalesce(${filter.type},0) ${filter.cmp} ${filter.value} `;
        break;
      case "is_cdlc":
        sql += `${filter.type} ${filter.cmp} '${filter.value}' `;
        break;
      default:
        break;
    }
    if (i < filters.length - 1) {
      sql += `${filter.gate} `;
    }
  }
  //console.log(sql);
  return sql;
}
export default class SetlistOptions extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      setlistName: '',
      isGenerated: null,
      isManual: null,
      filters: [],
      numResults: 0,
    }
    //tuning
    this.gates = ["and", "or"]
    this.fields = [
      {
        type: "artist",
        display: "Artist",
        cmp: ["like", "not like"],
      },
      {
        type: "song",
        display: "Song",
        cmp: ["like", "not like"],
      },
      {
        type: "album",
        display: "Album",
        cmp: ["like", "not like"],
      },
      {
        type: "arrangement",
        display: "Arrangement",
        cmp: ["like", "not like"],
      },
      {
        type: "mastery",
        display: "Mastery",
        cmp: [">=", "<=", "==", "<", ">"],
      },
      {
        type: "difficulty",
        display: "Difficulty",
        cmp: [">=", "<=", "==", "<", ">"],
      },
      {
        type: "count",
        display: "Playcount",
        cmp: [">=", "<=", "==", "<", ">"],
      },
      {
        type: "tempo",
        display: "Tempo",
        cmp: [">=", "<=", "==", "<", ">"],
      },
      {
        type: "is_cdlc",
        display: "CDLC",
        cmp: ["is"],
      },
    ];
  }
  shouldComponentUpdate = async (nextprops, nextstate) => {
    if (nextprops !== this.props) {
      this.setState({
        setlistName: nextprops.info.name,
        isGenerated: nextprops.info.is_generated === "true",
        isManual: nextprops.info.is_manual === "true",
      })
      if (nextprops.info.is_manual === "true") {
        this.setState({
          numResults: 0,
          filters: [],
        });
      }
      else {
        const viewsql = nextprops.info.view_sql;
        let jsonObj = [];
        try {
          if (viewsql.length > 0) jsonObj = JSON.parse(viewsql);
        }
        catch (e) {
          jsonObj = []
        }
        this.setState({
          numResults: 0,
          filters: jsonObj,
        }, () => this.runQuery())
        // run viewsql and find results
      }
    }
    return nextprops.showOptions;
  }
  handleChange = (event) => {
    this.setState({ setlistName: event.target.value });
  }
  handleHide = () => {
    this.props.close();
    enableScroll();
  }
  handleGenerated = (e) => {
    this.setState({
      isGenerated: e.currentTarget.value === "on",
      isManual: false,
      filters: [],
    });
  }
  handleManual = (e) => {
    this.setState({
      isManual: e.currentTarget.value === "on",
      isGenerated: false,
      filters: [],
    });
  }
  generateFilterTypeOptions = (filter, index) => {
    return (
      <select defaultValue={filter.type} onChange={event => this.handleSelectChange(event, "type", index)}>
        {
          this.fields.map((field, idx) => {
            return (
              <option value={field.type} key={"type_" + filter.id + field.type}>{field.display}</option>
            );
          })
        }
      </select>
    );
  }
  generateFilterComparatorOptions = (filter, index) => {
    let selectedField = null;
    for (let i = 0; i < this.fields.length; i += 1) {
      if (this.fields[i].type === filter.type) {
        selectedField = this.fields[i];
      }
    }
    return selectedField ? (
      <select defaultValue={filter.cmp} onChange={event => this.handleSelectChange(event, "comparator", index)}>
        {
          selectedField.cmp.map((field, idx) => {
            return (
              <option value={field} key={"cmp_" + filter.id + field}>{field}</option>
            );
          })
        }
      </select>
    ) : null;
  }
  generateFilterChainOptions = (filter, index) => {
    return (
      <select defaultValue={filter.gate} onChange={event => this.handleSelectChange(event, "chain", index)}>
        {
          this.gates.map((field, idx) => {
            return (
              <option value={field} key={"chain_" + filter.id + field}>{field}</option>
            );
          })
        }
      </select>
    );
  }
  handleSelectChange = (event, type, index) => {
    const filters = this.state.filters;
    switch (type) {
      case "chain":
        filters[index].gate = event.target.value;
        break;
      case "comparator":
        filters[index].cmp = event.target.value;
        break;
      case "type": {
        filters[index].type = event.target.value;
        let selected = null;
        for (let i = 0; i < this.fields.length; i += 1) {
          const field = this.fields[i];
          if (field.type === event.target.value) selected = field;
        }
        if (selected) filters[index].cmp = selected.cmp[0];
        break;
      }
      default:
        break;
    }
    this.setState({ filters });
  }
  handleValueChange = (event, index) => {
    const filters = this.state.filters;
    filters[index].value = event.target.value;
    this.setState({ filters });
  }
  saveOptions = async () => {
    console.log("save setlist: " + this.props.info.key);
    await createRSSongList(
      this.props.info.key, this.state.setlistName, this.state.isGenerated,
      this.state.isManual, JSON.stringify(this.state.filters),
    );
    this.props.refreshTabs();
    this.props.fetchMeta();
    this.handleHide();
  }
  deleteSetlist = async () => {
    console.log("delete setlist: " + this.props.info.key);
    await deleteRSSongList(this.props.info.key)
    this.props.refreshTabs();
    this.props.clearPage();
    this.handleHide();
    //delete setlist db
    //delete meta info from setlist_meta
  }
  addFilter = async () => {
    const ts = Math.round((new Date()).getTime() / 1000);
    const defaultFilter = {
      type: "artist",
      cmp: "like",
      value: "",
      gate: "and",
      id: ts.toString(),
    }
    const filters = this.state.filters;
    filters.push(defaultFilter);
    this.setState({ filters })
  }
  removeFilter = async (index) => {
    const filters = this.state.filters;
    filters.splice(index, 1);
    this.setState({ filters })
  }

  runQuery = async () => {
    if (this.state.filters != null && this.state.filters.length > 0) {
      const sql = await generateSql(this.state.filters, true);
      try {
        const op = await executeRawSql(sql);
        this.setState({ numResults: op.acount });
      }
      catch (e) {
        console.log(e);
        this.setState({ numResults: -1 });
      }
    }
  }
  render = () => {
    const modalinfostyle = "width-75-2"
    const buttonstyle = "extraPadding download"
    if (this.props.showOptions === false) { return null; }
    return (
      <div ref={(ref) => { this.modal_div = ref }} id="open-modal" className="modal-window" style={{ opacity: 1, pointerEvents: "auto" }}>
        <div id="modal-info" className={modalinfostyle}>
          <a onKeyUp={this.onKeyUp} title="Close" className="modal-close" onClick={this.handleHide}>Close</a>
          <br />
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ fontSize: 150 + "%", fontWeight: 'bold', marginTop: -25 + 'px' }}>
              Setlist Options
            </h4>
            <hr />
            <div style={{ fontSize: 20 + 'px' }}>
              <table style={{ width: 100 + '%' }}>
                <tbody>
                  <tr style={{ backgroundColor: 'inherit', border: 'none', color: 'black' }}>
                    <td style={{ border: 'none', width: 20 + '%', borderRight: '1px solid' }}>Name</td>
                    <td style={{ border: 'none', width: 80 + '%', textAlign: 'left' }}>
                      <input type="text" defaultValue={this.state.setlistName} onChange={this.handleChange} style={{ paddingLeft: 10 + 'px', width: 80 + '%' }} />
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: 'inherit', border: 'none', color: 'black' }}>
                    <td style={{ border: 'none', width: 20 + '%', borderRight: '1px solid' }}>Type</td>
                    <td style={{
                      border: 'none', width: 80 + '%', textAlign: 'left', fontSize: 16 + 'px',
                    }}>
                      <div>
                        <input
                          type="radio"
                          id="setlist_manual"
                          name="setlist_manual"
                          checked={this.state.isManual === true}
                          onChange={this.handleManual}
                        />
                        <label style={{ paddingLeft: 10 + 'px' }} htmlFor="setlist_manual">Manual (Add Songs manually)</label>
                      </div>
                      <div>
                        <input
                          type="radio"
                          id="setlist_generated"
                          name="setlist_generated"
                          checked={this.state.isGenerated === true}
                          onChange={this.handleGenerated}
                        />
                        <label style={{ paddingLeft: 10 + 'px' }} htmlFor="setlist_generated">Generated (Add Songs via filters)</label>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              {
                this.state.isGenerated ?
                  (
                    <div>
                      <h4>Filters</h4>
                      <hr />
                      <button
                        type="button"
                        id="settingsExpand"
                        className="navbar-btn"
                        onClick={this.addFilter}
                        style={{ float: 'right', marginTop: -62 + 'px' }}
                      >
                        <span /><span /><span />
                      </button>
                      {
                        this.state.filters != null && this.state.filters.length > 0 ?
                          <div>
                            <table
                              className="filterTable"
                              style={{
                                width: 100 + '%',
                                marginTop: 30 + 'px',
                                marginBottom: 12 + 'px',
                              }}>
                              <thead>
                                <tr>
                                  <td>Filter Type</td>
                                  <td>Comparator</td>
                                  <td>Value</td>
                                  <td>Logic Chain</td>
                                  <td>Delete</td>
                                </tr>
                              </thead>
                              <tbody>
                                {
                                  this.state.filters.map((filter, index) => {
                                    return (
                                      <tr key={"row_" + filter.id}>
                                        <td style={{ width: 20 + '%' }}>
                                          {this.generateFilterTypeOptions(filter, index)}
                                        </td>
                                        <td style={{ width: 20 + '%' }}>
                                          {this.generateFilterComparatorOptions(filter, index)}
                                        </td>
                                        <td style={{ width: 40 + '%' }}>
                                          <input
                                            key={"input_" + filter.id}
                                            type="text"
                                            defaultValue={filter.value}
                                            onChange={event => this.handleValueChange(event, index)}
                                            style={{ paddingLeft: 10 + 'px', width: 80 + '%' }} />
                                        </td>
                                        {
                                          (index < this.state.filters.length - 1) ?
                                            <td style={{ width: 15 + '%' }}>
                                              {this.generateFilterChainOptions(filter, index)}
                                            </td> : <td />
                                        }
                                        <td style={{ width: 5 + '%' }}>
                                          <button
                                            type="button"
                                            id="settingsCollapse"
                                            className="navbar-btn"
                                            onClick={() => this.removeFilter(index)}
                                          >
                                            <span /><span /><span />
                                          </button>
                                        </td>
                                      </tr>
                                    )
                                  })
                                }
                              </tbody>
                            </table>
                            <span>
                              <a
                                href="#"
                                onClick={this.runQuery}
                                style={{ borderBottom: "1px solid gray" }}>
                                Run Query
                              </a>: {this.state.numResults} arrangements.
                             </span>
                          </div>
                          : null
                      }
                    </div>
                  )
                  : null
              }
            </div>
            <div>
              <br />
              <hr />
              <a
                onClick={this.saveOptions}
                className={buttonstyle}>
                Save Options
            </a>
              <a
                onClick={this.deleteSetlist}
                className={buttonstyle}>
                Delete Setlist
            </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
SetlistOptions.propTypes = {
  //eslint-disable-next-line
  info: PropTypes.object,
  close: PropTypes.func,
  showOptions: PropTypes.bool,
  refreshTabs: PropTypes.func,
  fetchMeta: PropTypes.func,
  clearPage: PropTypes.func,
}
SetlistOptions.defaultProps = {
  info: {
  },
  close: () => { },
  showOptions: false,
  refreshTabs: () => { },
  fetchMeta: () => { },
  clearPage: () => { },
}